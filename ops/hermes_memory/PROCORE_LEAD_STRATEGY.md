# ProCore Lead Strategy

## Business Goal

Each case should help future vehicle owners decide whether to contact ProCore.
The article should reduce uncertainty and make the next step obvious: send the
vehicle year, model, location, issue, and photos through LINE.

## High-Intent Case Types

Prioritize stronger SEO effort for:

- all keys lost
- auction lot or repossessed vehicle pickup
- underground parking or hard-to-move vehicles
- European and high-value vehicles
- smart key not detected
- owners with only one remaining key

## Content Clusters

Build clusters instead of isolated posts:

- `地區 + 鑰匙全丟`: 林口、台中、彰化、雲林、嘉義
- `品牌 + 問題`: BMW, Benz, VW, Audi, Suzuki, Toyota
- `場景 + 問題`: 拍場、地下室、路邊、保修廠
- `預防型內容`: 備用鑰匙、遙控異常、感應不良

## Conversion Signals

A good article should answer:

- Can ProCore understand my car and situation?
- What should I prepare before asking?
- Do I need to tow the car?
- Will my private information be exposed?
- How do I contact ProCore now?

## Learning Log Usage

After each publish, append one JSON line to `CASE_LEARNING_LOG.jsonl` with:

- date
- vehicle
- location
- issue
- title
- URL
- Otto feedback
- whether the article produced LINE inquiries, if known
- wording that should be reused or avoided
