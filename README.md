# IG Agent Pipeline

Pipeline di proposta → approvazione → generazione → approvazione → pubblicazione
per contenuti Instagram, con approvazione via Telegram.

## Setup

### 1. Supabase
- Crea un progetto su supabase.com
- Esegui `schema.sql` nell'SQL Editor
- Copia `SUPABASE_URL` e la `service_role key` (Settings → API)

### 2. Bot Telegram
- Parla con [@BotFather](https://t.me/BotFather), crea un bot con `/newbot`
- Copia il token (`TELEGRAM_BOT_TOKEN`)
- Scrivi un messaggio qualsiasi al tuo bot, poi vai su
  `https://api.telegram.org/bot<TOKEN>/getUpdates` per trovare il tuo `chat_id`
- Dopo il deploy, imposta il webhook:
  ```
  https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<tuo-progetto>.vercel.app/api/telegram/webhook
  ```

### 3. Meta / Instagram Graph API
- Crea un'app su [developers.facebook.com](https://developers.facebook.com)
- Aggiungi il prodotto "Instagram Graph API"
- Il tuo account Instagram deve essere Business/Creator e collegato a una Pagina Facebook
- Genera un access token long-lived con i permessi `instagram_content_publish`,
  `pages_read_engagement`, `pages_show_list`
- Trova il tuo `IG_USER_ID` con:
  `GET https://graph.facebook.com/v21.0/me/accounts?access_token=<TOKEN>`
  poi per ogni pagina: `GET /<PAGE_ID>?fields=instagram_business_account&access_token=<TOKEN>`

### 4. Variabili d'ambiente (Vercel)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=   # usata per generare l'immagine (DALL-E 3)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
IG_USER_ID=
IG_ACCESS_TOKEN=
CRON_SECRET=       # stringa a caso, protegge gli endpoint cron
```

### 5. Deploy
```
npm install @supabase/supabase-js
vercel deploy --prod
```

## Nota sulle immagini

Il flusso genera *caption + prompt immagine* con Claude, poi l'immagine vera e propria
con OpenAI (DALL-E 3, richiede `OPENAI_API_KEY`) e la carica sul bucket pubblico
`post-images` di Supabase Storage, salvando l'URL in `posts.image_url` automaticamente.

## Flusso completo

1. Lunedì 8:00 → `weekly-plan.js` genera 3 proposte e le manda su Telegram
2. Approvi il calendario → status passa a `calendar_approved`
3. Ogni giorno alle 8:00 → `daily-content.js` controlla se c'è un post
   previsto per oggi con calendario approvato, genera caption + prompt immagine,
   te lo manda su Telegram
4. Approvi il contenuto (dopo aver caricato l'immagine) → pubblicazione
   automatica su Instagram via Graph API
