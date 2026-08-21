# Audio submissions

## Local setup

Use Node.js 20+, MongoDB, `ffprobe`, and `ffmpeg` on `PATH`. Copy `.env.example` to `.env` and start MongoDB locally:

```sh
npm install
npm test
npm start
```

Uploads are stored locally in `UPLOAD_DIR` (default `./uploads`); MongoDB stores the submission metadata and generated filename. `CORS_ORIGIN` defaults to `http://localhost:5173`. Requests without an Origin are allowed, and no credentials are used.

## API

`GET /health` returns `{ "ok": true }`.

`POST /api/audio-submissions` accepts `multipart/form-data` with an `audio` file, `name`, and `phone`. Accepted extensions are `.mp3`, `.wav`, `.m4a`, `.mp4`, `.ogg`, `.webm`, `.flac`, and `.aac`; `.mp4` accepts `audio/mp4` or `video/mp4`. Metadata is extracted with `ffprobe` and `ffmpeg` before the Mongo record is created.

The 201 response is the saved submission object. `GET /api/audio-submissions` returns submissions newest first. `GET /api/audio-submissions/:id/audio` streams the locally stored file.
