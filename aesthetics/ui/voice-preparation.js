/* Shared, bounded Realtime preparation. No microphone or model response before
   start(); credentials remain in memory. Callers own opt-in, scope and UI. */
(function (root) {
  'use strict';
  function create(options) {
    let current = null;
    const clock = () => performance.now();
    const metrics = [];
    const record = (s, name) => {
      const entry = { name, ms: Math.round(clock() - s.created), sinceWakeMs: s.wokeAt == null ? null : Math.round(clock() - s.wokeAt), prepared: !!s.wasPrepared };
      metrics.push(entry); if (metrics.length > 40) metrics.shift();
      options.onTiming?.(entry);
    };
    const valid = s => !!s && current === s && !s.closed && !!s.scope && options.scope() === s.scope;
    function stop(reason = 'stopped') {
      const s = current; current = null;
      if (!s) return;
      s.closed = true; s.controller.abort();
      clearTimeout(s.deadline); clearTimeout(s.captureDeadline); clearTimeout(s.idle); clearTimeout(s.maximum); clearInterval(s.scopeTimer);
      try { s.dc?.close(); } catch (_) {}
      try { s.pc?.close(); } catch (_) {}
      try { s.mic?.getTracks().forEach(track => track.stop()); } catch (_) {}
      try { s.audio?.pause(); s.audio.srcObject = null; } catch (_) {}
      record(s, reason); options.onStop?.(reason, s);
    }
    function checkScope() {
      if (current && !valid(current)) stop('scope-changed');
      return !!current;
    }
    function idle(s) {
      clearTimeout(s.idle);
      s.idle = setTimeout(() => { if (valid(s)) stop('idle'); }, 120000);
    }
    async function resumePlayback() {
      const s = current; if (!valid(s) || !s.active) return false;
      try { await s.audio.play(); if (!valid(s)) return false; s.playbackBlocked = false; record(s, 'playback-ready'); return true; }
      catch (_) { if (valid(s)) { s.playbackBlocked = true; options.onPlaybackBlocked?.(s); } return false; }
    }
    function begin(prepared) {
      checkScope(); if (current) return current;
      const scope = options.scope(); if (!scope) throw new Error('not-signed-in');
      const s = { scope, created: clock(), wasPrepared: prepared, active: false, closed: false, controller: new AbortController(), mic: null };
      current = s;
      // Cancellation settles callers even when a browser/provider ignores abort.
      s.cancelled = new Promise((_, reject) => s.controller.signal.addEventListener('abort',
        () => reject(s.failure || new DOMException('Voice preparation cancelled', 'AbortError')), { once: true }));
      s.cancelled.catch(() => {});
      try {
      s.audio = new Audio(); s.audio.autoplay = false; s.audio.playsInline = true; s.audio.setAttribute('playsinline', '');
      s.pc = new RTCPeerConnection();
      // Negotiate the audio sender without a track. No ambient audio is sent.
      s.sender = s.pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
      s.dc = s.pc.createDataChannel('oai-events');
      } catch (error) { stop('unsupported'); throw error; }
      s.pc.ontrack = event => { if (!valid(s)) return; s.audio.srcObject = event.streams[0]; if (s.active) void resumePlayback(); };
      s.pc.onconnectionstatechange = () => { if (valid(s) && ['failed', 'disconnected', 'closed'].includes(s.pc.connectionState)) stop('disconnected'); };
      s.dc.onmessage = event => {
        if (!valid(s)) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'session.created' || message.type === 'session.updated') s.confirmSession?.();
          if (!s.active) return;
          if (message.type === 'input_audio_buffer.speech_started' || message.type === 'response.done') idle(s);
          if (message.type === 'input_audio_buffer.speech_started') record(s, 'speech-started');
          if (message.type === 'output_audio_buffer.started' && !s.firstAudio) { s.firstAudio = true; record(s, 'first-audio'); }
        } catch (_) { if (!s.active) return; }
        options.onMessage?.(event, s);
      };
      s.scopeTimer = setInterval(checkScope, 250);
      s.deadline = setTimeout(() => { if (valid(s)) stop('setup-timeout'); }, 20000);
      const channel = new Promise((resolve, reject) => {
        s.dc.onopen = resolve;
        s.controller.signal.addEventListener('abort', () => reject(new DOMException('Voice preparation cancelled', 'AbortError')), { once: true });
      });
      const sessionCreated = new Promise((resolve, reject) => {
        s.confirmSession = resolve;
        s.controller.signal.addEventListener('abort', () => reject(new DOMException('Voice preparation cancelled', 'AbortError')), { once: true });
      });
      // Attach rejection observers immediately: cancellation can precede SDP.
      channel.catch(() => {}); sessionCreated.catch(() => {});
      s.ready = Promise.race([s.cancelled, (async () => {
        await Promise.resolve(); // start() requests microphone permission in the gesture first.
        if (!valid(s)) throw new DOMException('Cancelled', 'AbortError');
        const tokenPromise = options.token(s.controller.signal);
        const offerPromise = (async () => { const offer = await s.pc.createOffer(); if (!valid(s)) throw new DOMException('Cancelled', 'AbortError'); await s.pc.setLocalDescription(offer); return offer; })();
        const [token, offer] = await Promise.all([tokenPromise, offerPromise]);
        if (!valid(s)) throw new DOMException('Cancelled', 'AbortError');
        if (!token?.value || !token?.model) throw new Error('voice-token-invalid');
        record(s, 'token-ready');
        const response = await fetch('https://api.openai.com/v1/realtime/calls?model=' + encodeURIComponent(token.model), {
          method: 'POST', headers: { Authorization: 'Bearer ' + token.value, 'Content-Type': 'application/sdp' }, body: offer.sdp, signal: s.controller.signal
        });
        if (!response.ok) throw new Error('call ' + response.status);
        const answer = await response.text(); if (!valid(s)) throw new DOMException('Cancelled', 'AbortError');
        await s.pc.setRemoteDescription({ type: 'answer', sdp: answer }); await Promise.all([channel, sessionCreated]);
        if (!valid(s)) throw new DOMException('Cancelled', 'AbortError');
        record(s, 'connection-ready'); clearTimeout(s.deadline);
        // One bounded standby, never a timer-driven paid reconnection loop.
        s.deadline = setTimeout(() => { if (valid(s) && !s.active) stop('standby-expired'); }, 120000);
        return s;
      })()]).catch(error => { if (current === s) { if (error.name !== 'AbortError') s.failure = error; stop(error.name === 'AbortError' ? 'cancelled' : 'failed'); } throw error; });
      s.ready.catch(() => {});
      return s;
    }
    function prepare() {
      try { return begin(true).ready; } catch (error) { return Promise.reject(error); }
    }
    async function start() {
      const s = begin(false);
      if (s.active) return s;
      if (s.starting) return s.starting;
      s.wokeAt = clock(); record(s, 'wake');
      // A microphone permission prompt may never resolve, even on a warm line.
      s.captureDeadline = setTimeout(() => { if (valid(s) && s.starting) stop('setup-timeout'); }, 20000);
      // Ask immediately during the wake/tap, not after any network wait.
      let microphone;
      try { microphone = navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (error) { stop('microphone-failed'); throw error; }
      s.starting = (async () => {
        const micPromise = Promise.resolve(microphone).then(mic => {
          if (!valid(s)) { mic.getTracks().forEach(track => track.stop()); throw new DOMException('Cancelled', 'AbortError'); }
          s.mic = mic; record(s, 'microphone-ready'); return mic;
        });
        const [mic] = await Promise.race([Promise.all([micPromise, s.ready]), s.cancelled]);
        if (!valid(s)) throw new DOMException('Cancelled', 'AbortError');
        clearTimeout(s.deadline);
        // Fresh page context is sent before audio can reach the prepared line.
        s.active = true; options.onActive?.(s);
        if (!valid(s)) throw new DOMException('Cancelled', 'AbortError');
        await Promise.race([s.sender.replaceTrack(mic.getAudioTracks()[0]), s.cancelled]);
        if (!valid(s)) throw new DOMException('Cancelled', 'AbortError');
        clearTimeout(s.captureDeadline);
        record(s, 'microphone-attached'); idle(s);
        s.maximum = setTimeout(() => { if (valid(s)) stop('session-limit'); }, 15 * 60 * 1000);
        void resumePlayback();
        return s;
      })().catch(error => { if (current === s) stop(error.name === 'AbortError' ? 'cancelled' : 'failed'); throw error; });
      return s.starting;
    }
    return { prepare, start, stop, checkScope, isCurrent: valid, resumePlayback, get current() { return current; }, metrics };
  }
  root.MayaVoicePreparation = { create };
})(window);
