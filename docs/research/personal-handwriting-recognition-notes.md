# Personal Handwriting Recognition — Research Notes

Status: exploratory personal research notes. This is not an implementation commitment or current development priority.

## Core idea

The handwriting feature could become personalised to an individual writer rather than relying only on a general handwritten-text recogniser.

A user could begin with an enrolment exercise consisting of a fixed reference passage, perhaps two or three pages long, deliberately constructed to cover the alphabet, common letter combinations, punctuation, numerals, capitals, and representative word shapes. The user handwrites that known passage and submits photographs or scans of the pages.

Because the application already knows the exact reference text and its sequence, it can use that text as supervision. The page image can be segmented into lines, words, or smaller image crops and those regions can be aligned against indexed locations in the known reference passage. This would gradually create a writer-specific repository containing handwriting-image examples paired with known text.

The important concept is not simply to keep whole-page examples. Where alignment confidence is good enough, the application could retain smaller crops representing words, character groups, or recurring glyph patterns. Those examples could form a personal handwriting profile that can later assist recognition of new pages written by the same person.

## Possible enrolment pipeline

1. Present a fixed calibration passage to the user.
2. The user copies the passage by hand over several pages.
3. Capture or scan the pages.
4. Perform page cleanup and segmentation into lines and smaller text regions.
5. Align the visual regions sequentially against the known reference text.
6. Store trusted image/text pairs in the user's handwriting profile.
7. Use those pairs for later recognition, model adaptation, retrieval, or correction.

The exact segmentation should remain an implementation question. It may be more reliable to begin from line-level or word-level recognition and only derive smaller character or glyph examples when alignment confidence is high, rather than assuming every handwritten character can always be cleanly isolated.

## Learning from ordinary handwriting

Personalisation should not have to stop after the initial calibration pages.

The user could submit ordinary handwritten notes or manuscript pages. A baseline OCR model produces a transcription, potentially followed by language-model-assisted interpretation. The application shows the result to the user and records explicit corrections.

Those corrections then become new labelled examples. Because the system has both the original image region and the corrected text, it can realign the page and add trusted examples to the user's handwriting profile. Over time, the profile should become increasingly representative of that user's actual handwriting rather than only the neat handwriting used during initial enrolment.

A possible feedback loop is:

handwritten image -> baseline OCR -> contextual interpretation -> user correction -> image/text realignment -> writer-specific examples -> improved future recognition

## Sequential and contextual alignment

When the application knows the expected text, such as during enrolment, sequential alignment is especially valuable. It does not need to infer every word independently because the reference sequence constrains what each region is likely to contain.

For unknown handwritten pages, contextual or semantic reasoning could instead help resolve uncertain OCR output. This should be treated separately from the visual recogniser. A language model may help rank plausible interpretations, use neighbouring words as context, and reconcile a transcription against the user's corrections, but the system should preserve the distinction between:

- visual handwriting recognition;
- alignment of image regions with text;
- writer-specific adaptation or retrieval;
- semantic/contextual correction.

This distinction matters because an LLM guessing a plausible sentence is not the same thing as actually recognising the marks on the page.

## Personal handwriting repository

The application could maintain a private writer profile containing some combination of:

- calibration page images;
- line-level image/text pairs;
- word-level image/text pairs;
- high-confidence recurring glyph or character-pattern crops;
- OCR predictions and confidence values;
- accepted user corrections;
- contextual variants of the same letter or word shape;
- metadata about pen, page, capture conditions, or writing style where useful.

This repository could support several different technical approaches without committing the product to one today. Possibilities include retrieval of visually similar examples, lightweight adapter training, periodic fine-tuning, confidence re-ranking, or a hybrid of these.

## TrOCR — what it actually provides

TrOCR should not be described as automatically learning an individual user's handwriting during normal inference.

Microsoft's TrOCR is an end-to-end optical character recognition architecture using a pretrained image Transformer encoder and text Transformer decoder. The published work demonstrates printed and handwritten text recognition and describes pretraining and fine-tuning on labelled datasets.

That means TrOCR could plausibly serve as a baseline visual recogniser or as a model that is later adapted using writer-specific labelled examples. However, the personal enrolment system, correction memory, writer-profile repository, continual adaptation loop, and automatic learning from an individual user's corrections are application-level ideas described in this note. They are not built-in TrOCR behaviour claimed by the original paper.

Earlier discussion that implied TrOCR itself already provides automatic per-user handwriting learning was too strong. The accurate statement is: TrOCR supports a technical route for handwritten recognition and supervised fine-tuning; this application could build a personalisation layer around a recogniser such as TrOCR.

## Model-training terminology

The personal handwriting component should not automatically be described as "training the LLM." TrOCR itself is a vision-to-text Transformer model. A separate LLM could be used for semantic correction or contextual ranking, while writer-specific visual adaptation may involve fine-tuning the OCR model, training a small adapter, storing embeddings/examples for retrieval, or another specialised mechanism.

Keeping those components separate will make later experimentation easier and will help determine whether full per-user model training is actually necessary.

## Open research questions

- How much calibration handwriting is needed before personalisation produces a measurable improvement?
- Is two or three pages sufficient, or should enrolment adaptively request missing letters and letter combinations?
- Is word-level, line-level, character-level, or mixed supervision most robust for natural cursive handwriting?
- Can writer-specific retrieval improve accuracy enough that model fine-tuning is unnecessary?
- If fine-tuning is useful, can parameter-efficient adapters be used so each user does not require a complete duplicate OCR model?
- How should the system prevent incorrect OCR guesses from contaminating the personal training set?
- What confidence threshold should be required before automatically storing a segmented image/text pair?
- Should only explicit user corrections be considered authoritative for continual learning?
- How should the system distinguish genuine handwriting variation from poor lighting, perspective distortion, blur, or pen/page changes?
- How much improvement comes from a semantic language model versus genuine improvement in visual recognition?

## Product principle

The long-term goal is a handwriting system that starts with a competent general recogniser but becomes increasingly familiar with the individual writer through known calibration text and explicit correction feedback. The user's own handwriting and corrections become supervised evidence for that personal profile.

This remains a research direction to return to later; it should not displace the application's current higher-priority stabilisation work.
