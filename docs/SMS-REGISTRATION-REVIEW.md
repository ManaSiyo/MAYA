# SMS registration repair, September 22

Current owner decision: customer-facing, human-led texting and callbacks through
Maya. The owner-only draft below is superseded. Wix callback notice alone has
not been verified as sufficient SMS consent. A separate checkbox is one explicit
opt-in method, not the only method; choose and implement a truthful compact flow
before resubmitting. Do not claim the flow already exists.

Owner screenshots confirm: account Active; A2P brand complete; campaign rejected
because a compliant privacy policy could not be verified; messaging overview
reports 30034. September 22 at 09:46 inbound 'Hi.' is Received in Twilio.
At 17:00 outbound 'hello' is Undelivered. Receipt by Twilio does not prove the
application webhook stored that inbound message. No new SMS or call is needed.

## Earlier owner-only draft (superseded; do not use for customer registration)

Owner clarified that the Wix form currently has no separate SMS checkbox and
that Maya texting is being set up for the owner himself first. Do not register
an imaginary existing Wix opt-in flow. Customer registration draft below is for
a later stage, once that flow is live. Registration is still required for app
messages to the owner's own US number; a test recipient is not an exemption.

Current campaign-description draft:
Mana Siyo Inc. uses its Maya application for internal SMS testing and requested
service notifications to its business owner. The owner is the only intended
recipient during this setup stage and has explicitly authorized messages to his
own mobile number. No customers, purchased lists or promotional recipients are
included in this stage.

Current samples (use only messages actually planned):
1. Mana Siyo Maya: This is the internal SMS test you requested. Reply STOP to opt out.
2. Mana Siyo Maya: Your requested messaging test is complete. Reply HELP for help
   or STOP to opt out.
Additional samples may be left empty if Twilio does not require them. Do not
invent customer messages or working automated alerts for this internal campaign.

Current Message Flow draft, requires a real retained consent record:
The sole recipient is Mana Siyo's business owner, who explicitly opts in to
receive internal Maya test messages and requested service notifications on his
own mobile number. This stage does not enroll customers through the Wix callback
form. The owner can withdraw consent with STOP. Provide the actual opt-in record
and its accessible evidence location as requested by Twilio; do not claim a
website checkbox or keyword enrollment exists if it does not.

The owner has authorized texts in this Codex conversation, but this is not
necessarily reviewer-accessible evidence. Prepare a signed/dated owner consent
record identifying Mana Siyo, SMS types, frequency, rate notice, STOP/HELP and
policy links, and provide evidence through Twilio's accepted review process.
Do not publish private phone numbers or credentials as public proof. If the
current campaign's customer-care use case cannot be changed to fit the actual
internal purpose, ask Twilio support how to correct it before paying to resubmit.
Keep privacy/terms consistent with the internal program too. Customer texting
will require updating the registered scope and obtaining customer SMS consent.

## Selected scope: customer-facing texting and callbacks


1. Publish the reviewed SMS policy changes. Public URLs return HTTP 200 today:
   https://maya.manasiyo.com/privacy.html and https://maya.manasiyo.com/terms.html.
   Reachable does not mean the submitted URL or policy passed review.
2. On the actual Wix callback form, add a separate optional, unchecked SMS box,
   with clickable links to those same documents. Allow a callback request with
   that box unchecked. Keep a record of consent, time, source and disclosed text.
   Existing callback phone numbers must not be retroactively treated as opt-ins.
3. Suggested checkbox text: "I agree to receive SMS from Mana Siyo about my
   inquiry, appointments and order updates. Message frequency varies. Message
   and data rates may apply. Reply STOP to opt out or HELP for help. Consent is
   not a condition of purchase. Privacy Policy | Terms of Service."
4. Use the exact live policy URLs in Twilio and in the Message Flow description.
   Check the published Wix page while signed out. Do not claim the form is fixed
   until this flow is actually published and consent recording works.

## Campaign fields: draft for owner verification

Campaign description:
Mana Siyo Inc. is a custom clothing design studio. We send customer-care SMS to
people who explicitly agree to receive texts about their inquiry: consultation
scheduling, appointment reminders, garment/order updates and requested payment
links. We do not use purchased lists or send unsolicited promotional texts.

Sample 1:
Mana Siyo: Hi [first name], thanks for your garment inquiry. What time works for
your requested consultation? Reply STOP to opt out.

Sample 2:
Mana Siyo: Your fitting is scheduled for [date] at [time]. Reply to request a
different time. Reply STOP to opt out.

Sample 3:
Mana Siyo: Your [garment] is ready for your next fitting. Reply with a convenient
time. Reply STOP to opt out.

Sample 4:
Mana Siyo: Here is the payment link you requested: [actual payment URL]. Reply
with any questions. Reply STOP to opt out.

Sample 5:
Mana Siyo: Following up on your requested consultation. Call our studio at
510-990-9223 or reply here. Reply STOP to opt out.

Check Embedded links and Phone numbers if these are actually in the campaign.
Leave lending and age-gated content unchecked for this clothing customer-care
program. Match the selected use case to this actual purpose.

Message Flow draft, USE ONLY after the form above is live:
Customers visit https://manasiyo.com/design and submit an inquiry. They separately
choose an optional SMS-consent checkbox, unchecked by default. The disclosure
identifies Mana Siyo, describes inquiry/appointment/order messages, states that
frequency varies and message/data rates may apply, gives STOP/HELP instructions,
and says consent is not a condition of purchase. Privacy and terms links appear
beside the checkbox. Submitting a callback request without opting in does not
subscribe the customer to SMS. Consent records are retained. Policies:
https://maya.manasiyo.com/privacy.html and https://maya.manasiyo.com/terms.html.

Keywords and responses MUST match the actual Messaging Service configuration.
The application handles incoming START/UNSTOP and STOP/STOPALL/UNSUBSCRIBE/CANCEL/
END/QUIT for local consent; it does not itself send automatic HELP/START/STOP
responses. Verify Twilio's keyword handling; do not invent configured keywords.
Use Twilio-managed responses where enabled, without duplicate application replies.

Suggested opt-in confirmation, if configuring it:
Mana Siyo: You are subscribed to SMS about your inquiry, appointments and order.
Message frequency varies. Message and data rates may apply. Reply HELP for help
or STOP to opt out.

Suggested opt-out confirmation, if configuring it:
Mana Siyo: You have unsubscribed and will receive no further messages. Reply START
to resubscribe.

Suggested HELP response, if configuring it:
Mana Siyo: For help, email worldofsiyo@gmail.com. Message frequency varies.
Message and data rates may apply. Reply STOP to opt out.

Run Twilio's error check after the live pages, consent flow and registration agree.
Review any displayed charges before submitting. The checker is not approval.
After approval, verify the studio number belongs to the campaign's Messaging
Service sender pool. Do not repeatedly send paid tests while registration fails.

## Incoming message diagnosis

Open the existing September 22 09:46 Received message. Read Request Inspector:
webhook URL, HTTP status and error. Expected POST path: /api/phone/sms on the
configured Maya or Cloud Run host. If it never called Maya, inspect the number's
Messaging configuration and the Messaging Service Integration setting. If it
returned 403, inspect signature validation/host; 503 indicates storage failure.
A successful webhook still requires checking the exact number's Maya thread.
No conclusion about the inbound failure is possible from Received alone.

Sources:
https://www.twilio.com/docs/api/errors/30034
https://www.twilio.com/docs/api/errors/30908
https://www.twilio.com/docs/api/errors/30909
https://help.twilio.com/hc/en-us/articles/26149060902555-A2P-10DLC-Campaign-Registration-Recommendations
