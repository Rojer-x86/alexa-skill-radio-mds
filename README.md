# Radio MDS — Alexa skill

Играет поток MDS Station: `https://mds-station.com:8443/mds`
(HTTPS-зеркало `http://mds-station.com:8000/mds`, потому что Alexa не играет HTTP).

## Установка (Alexa-hosted, бесплатно, без AWS)

1. https://developer.amazon.com/alexa/console/ask → **Create Skill**
   - Name: `Radio MDS`, язык — тот же, что на колонке (например English (US))
   - Type: **Other → Custom**, Hosting: **Alexa-hosted (Node.js)**, Template: **Start from Scratch**
2. **Build → Interaction Model → JSON Editor** — вставить `skill-package/interactionModels/custom/en-US.json`
   (или файл своей локали), **Save** → **Build skill**.
3. **Build → Interfaces** — включить **Audio Player**, **Save**.
4. **Code** — заменить `index.js` и `package.json` файлами из `lambda/`, **Deploy**.
5. **Test** — включить "Development". Скил сразу появится на всех колонках вашего аккаунта.

## Как запускать

- "Alexa, open radio M D S"
- "Alexa, ask radio M D S to play"
- "Alexa, stop" / "Alexa, resume"

Короткую фразу можно сделать через Routine в приложении Alexa:
When you say → `radio m d s`, Action → **Skills → Radio MDS**.
