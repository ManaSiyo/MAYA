# Release 14.38

Owner explicitly requested shipping and live verification on September 24.

- Lead Station: Full name, Status, Latest Notes. Names open Messages; phone
  numbers remain in that drawer. Call/Text/Invoice actions retained below names;
  Invoice also available in the thread header for leads already in the station.
- Status choices: Passed, In process, Not contacted, In progress, Canceled.
  Old closed/contacted values display as Passed/In progress. Status-only canceled
  notes display as Canceled without changing original stored text. Header gear
  filters status. Stored contact-column position migrates to Status.
- Notes show a 120-character request excerpt with tier/price prefix removed and
  original text in a tooltip. This is deterministic shortening, not an AI
  semantic summary; original data remains intact and no AI call is charged.
- Lead data and model snapshot use Jost to match campaign-table typography.
  Drawer order: Messages, Logs, Systems (Systems rightmost). Updated outline gear.
- Model snapshot above Vault reads authenticated deployed server configuration
  for frontend/admin/fast text, image, web voice and phone voice. It does not
  claim a model is available or that a particular session used it.
- Outbound: campaign pain/criteria fields, people table, job-title and status
  filtering, existing campaign segmentation, saved research and draft tracking.
  Automatic sequences, delivery/reply synchronization and autonomous qualification
  remain outside this release; sending is still a human email-app handoff.
- Deployment blocker: screenshot proves Cloud Build for 2e1b47c failed in the
  avatar browser test before deployment. Updated isolated account fixtures,
  unsaved-avatar markup and stable-ID rename expectations. Gates stay enabled.

No credentials/environment/billing edits. Production authorization is limited to
shipping these repository changes. Fake-provider tests do not prove live SMS
carrier delivery or Hunter/Sheets/model access. Those checks remain pending.

Validation: hands smoke passed on frontend and Playground; Outbound 25; profile
27 plus stage/summary assertions; Admin UI 11; API smoke; JS syntax/diff checks.
