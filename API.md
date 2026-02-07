# Model Manager REST API

Base URL: `http://localhost:3000/api/v1`

## Authentication

All endpoints require authentication via Bearer token.

```
Authorization: Bearer <api-key>
```

### Managing API Keys

**CLI commands:**
```bash
# Show current API key (generates one if none exists)
npm run api-key show

# Regenerate API key
npm run api-key regenerate
```

The API key is stored in `{dataDir}/api-key.json`.

---

## Endpoints

### List Models

```
GET /api/v1/models
```

Returns a paginated list of models with optional filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category (e.g., "LoRA", "Checkpoint") |
| `subcategory` | string | Filter by subcategory |
| `baseModel` | string | Filter by base model |
| `type` | string | Filter by type |
| `search` | string | Search by model name |
| `tags` | string | Comma-separated list of tags |
| `maxNsfwLevel` | integer | Maximum NSFW level (0-63) |
| `hasMetadata` | boolean | Filter by metadata presence |
| `sort` | string | Sort order: `newest`, `oldest`, `name`, `downloads`, `likes` |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 40, max: 100) |

**Response:**

```json
{
  "items": [
    {
      "id": 123,
      "name": "Model Name",
      "type": "LORA",
      "category": "LoRA",
      "subcategory": "qwen",
      "baseModel": "Qwen",
      "nsfwLevel": 1,
      "creatorName": "username",
      "creatorAvatar": "https://...",
      "tags": ["tag1", "tag2"],
      "stats": {
        "downloadCount": 1000,
        "thumbsUpCount": 100,
        "thumbsDownCount": 5,
        "commentCount": 10,
        "tippedAmountCount": 500
      },
      "hasMetadata": true,
      "heroImage": {
        "id": 456,
        "thumbPath": "/path/to/thumb.webp",
        "width": 1024,
        "height": 1024,
        "nsfwLevel": 1,
        "blurhash": "UHHT..."
      }
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 40,
  "hasMore": true
}
```

---

### Get Model Details

```
GET /api/v1/models/:id
```

Returns detailed information about a specific model including all versions and files.

**Response:**

```json
{
  "id": 123,
  "name": "Model Name",
  "type": "LORA",
  "description": "<p>HTML description...</p>",
  "filePath": "/path/to/model.safetensors",
  "fileSize": 123456789,
  "category": "LoRA",
  "subcategory": "qwen",
  "baseModel": "Qwen",
  "nsfwLevel": 1,
  "creatorName": "username",
  "creatorAvatar": "https://...",
  "tags": ["tag1", "tag2"],
  "stats": {
    "downloadCount": 1000,
    "thumbsUpCount": 100
  },
  "trainedWords": ["word1", "word2"],
  "licensingInfo": {},
  "hasMetadata": true,
  "notes": "User notes about this model...",
  "versions": [
    {
      "id": 789,
      "name": "v1.0",
      "baseModel": "Qwen",
      "description": "Version description",
      "stats": {},
      "publishedAt": "2024-01-01T00:00:00Z",
      "trainedWords": ["word1"],
      "isLocal": true,
      "files": [
        {
          "id": 101,
          "fileName": "model.safetensors",
          "sizeKb": 123456,
          "format": "SafeTensor",
          "precision": "fp16"
        }
      ],
      "images": [
        {
          "id": 201,
          "localPath": "/path/to/image.png",
          "thumbPath": "/path/to/thumb.webp",
          "width": 1024,
          "height": 1024,
          "nsfwLevel": 1,
          "prompt": "generation prompt",
          "generationParams": {},
          "blurhash": "UHHT...",
          "sortOrder": 0,
          "isUserUpload": false
        }
      ]
    }
  ]
}
```

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Invalid model ID |
| 404 | Model not found |

---

### Download Model File

```
GET /api/v1/models/:id/download
```

Streams the model file for download.

**Response Headers:**

```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="model.safetensors"
Content-Length: 123456789
```

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Invalid model ID |
| 403 | File path outside allowed directory |
| 404 | Model or file not found |

---

### Regenerate API Key

```
POST /api/v1/auth/regenerate
```

Generates a new API key, invalidating the previous one.

**Response:**

```json
{
  "key": "new-64-character-hex-key",
  "message": "API key regenerated. Update your clients with the new key."
}
```

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Error message"
}
```

**Common Status Codes:**

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid Authorization header |
| 403 | Forbidden (file access denied) |
| 404 | Resource not found |

---

## Internal Endpoints

These endpoints are used by the web UI and don't require API key authentication (session-based).

### Update Model

```
PATCH /api/models/:id
```

Update model properties including user notes.

**Request Body:**

```json
{
  "name": "New Name",
  "type": "LORA",
  "baseModel": "SDXL 1.0",
  "notes": "Personal notes about this model..."
}
```

All fields are optional. Notes are stored separately and persist across rescans.

**Response:** Updated model object

---

### List User Images

```
GET /api/models/:id/images
```

Returns user-uploaded images for a model.

**Response:**

```json
[
  {
    "id": 1,
    "modelId": 123,
    "localPath": "/.data/uploads/123/abc.png",
    "thumbPath": "/.data/thumbs/upload_123_abc.webp",
    "width": 1024,
    "height": 1024,
    "nsfwLevel": 0,
    "prompt": "generation prompt",
    "generationParams": {
      "seed": 12345,
      "steps": 20,
      "sampler": "Euler a",
      "cfgScale": 7,
      "scheduler": "Karras",
      "loras": [{"name": "lora_name", "strength": 0.8}],
      "comfyWorkflow": {}
    },
    "sortOrder": 0,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

---

### Upload Image

```
POST /api/models/:id/images
```

Upload an image with optional generation parameters.

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Image file (JPEG, PNG, WebP, GIF; max 50MB) |
| `prompt` | string | Generation prompt |
| `negativePrompt` | string | Negative prompt |
| `seed` | integer | Seed value |
| `steps` | integer | Number of steps |
| `cfgScale` | number | CFG scale |
| `sampler` | string | Sampler name |
| `scheduler` | string | Scheduler name |
| `nsfwLevel` | integer | NSFW level (0-3) |
| `loras` | JSON string | Array of `{name, strength}` objects |
| `comfyWorkflow` | JSON string | ComfyUI workflow JSON |

**Response:** Created image object (status 201)

---

### Update User Image

```
PATCH /api/models/:id/images/:imageId
```

Update image metadata.

**Request Body:**

```json
{
  "prompt": "updated prompt",
  "nsfwLevel": 1,
  "sortOrder": 0,
  "generationParams": {}
}
```

**Response:** Updated image object

---

### Delete User Image

```
DELETE /api/models/:id/images/:imageId
```

Delete a user-uploaded image and its thumbnail.

**Response:**

```json
{
  "success": true
}
```

---

## Examples

```bash
# Get API key
API_KEY=$(npm run api-key show 2>/dev/null | grep "Current API key:" | cut -d: -f2 | tr -d ' ')

# List models
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3000/api/v1/models?limit=10&sort=newest"

# Get model details
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3000/api/v1/models/123"

# Download model
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3000/api/v1/models/123/download" \
  -o model.safetensors

# Regenerate API key
curl -X POST -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3000/api/v1/auth/regenerate"
```
