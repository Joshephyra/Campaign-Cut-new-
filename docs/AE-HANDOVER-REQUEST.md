# The request to send with the guide

Paste this into the email or message to the designer. Attach the three files: `AE-HANDOVER-GUIDE.md`, `preflight.jsx`, `dump.jsx`. Fill in the two blanks.

---

Subject: Your 6-second Ayudando y Perjudicando piece, prepared for CampaignCut

Hi [name],

We are building CampaignCut, a browser tool where campaign staff take a template built in After Effects, change the words, the photos and the disclaimer, and export a finished spot, without being able to break the animation. Your 6-second square GIF is the first real piece we want to run through it, so it comes out in the app looking exactly as you built it.

What I need from you is your After Effects project, prepared so our importer can read it, plus a few files alongside it. Attached are three things:

1. **AE-HANDOVER-GUIDE.md**, the step-by-step. It opens in any text editor or in a Markdown viewer. Read section 0 and section 1 first: section 1 is a table of everything on screen in your GIF and what each thing becomes. The rest walks through the project one pass at a time: cleaning up what the web player cannot carry, renaming the layers the staffer may change, checking the comp, exporting with Bodymovin, rendering a reference video, and what to put in the folder you send back. Nothing in it needs a terminal.

2. **preflight.jsx**, a checker that runs inside After Effects. With your comp open, go to File > Scripts > Run Script File and pick it. It writes a report next to your project file naming every layer it found a problem with, and tells you when the comp is ready to export. Run it as often as you like; it changes nothing.

3. **dump.jsx**, run the same way, once, at the end. It writes a map of the whole project so our developer can find anything by name if something goes missing in export. You do not need to read it.

The whole job is about two hours the first time, most of it the clean-up pass. The three things that matter most:

- The web player carries shapes, masks, text, images, transforms and easing, but not effects, layer styles, blend modes, 3D or motion blur. Anything that depends on those gets baked into a PNG. The look does not change; the guide shows how.
- The layers a staffer may change are renamed with the exact names in the guide, for example `cc.headline.1`. Everything else stays locked. Each plate and underline is named after its line, so it follows the new copy.
- Fonts: we find most on our own. Hand over a file only for a commercial face nobody but you has, and note that Adobe Fonts faces cannot be handed over at all, so a line set in one needs a face that can travel.

When you are done, zip the folder from section 9 and send it back. We import it, compare our playback frame by frame against your reference render, and send you side-by-side strips so you can judge whether it survived the trip. If anything drifted, the strips show exactly where, and it is usually one baked layer away from right.

Could you get it to me by [date]? If anything in the guide is unclear, or the project has something the guide does not cover, message me before working around it. We would rather adjust the importer than have you rebuild a layer.

Thanks,
Josh
