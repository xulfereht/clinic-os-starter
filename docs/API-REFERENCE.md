# Clinic-OS Admin API Reference

This document provides a complete reference for AI assistants to interact with the Clinic-OS database through validated APIs.

## Authentication

All Admin APIs require authentication via API Key header.

### Setup API Key

```bash
# Generate new API Key
curl -X POST https://your-domain.com/api/admin/settings/api-key \
  -H "Cookie: admin_session=YOUR_SESSION"
```

### Using API Key

Include the `X-Admin-API-Key` header in all requests:

```bash
curl https://your-domain.com/api/admin/staff \
  -H "X-Admin-API-Key: cos_YOUR_API_KEY"
```

---

## Response Format

All APIs return JSON with consistent structure:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 10, "limit": 50, "offset": 0 }
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

---

## Staff API

Manage clinic staff members (doctors, nurses, administrative staff).

### List Staff

```
GET /api/admin/staff
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by type: `doctor`, `staff`, `nurse` |
| isActive | string | Filter by status: `true`, `false` |
| limit | number | Results per page (default: 50) |
| offset | number | Pagination offset (default: 0) |

**Example:**
```bash
curl "https://your-domain.com/api/admin/staff?type=doctor&isActive=true" \
  -H "X-Admin-API-Key: cos_YOUR_API_KEY"
```

### Get Single Staff

```
GET /api/admin/staff/{id}
```

**Response includes translations if available.**

### Create Staff

```
POST /api/admin/staff
```

**Request Body:**
```json
{
  "name": "홍길동",
  "type": "doctor",
  "department": "내과",
  "position": "과장",
  "isActive": true,
  "orderIndex": 1,
  "bio": "소개글...",
  "specialties": "[\"내시경\", \"소화기질환\"]",
  "education": "학력 정보",
  "career": "경력 정보",
  "image": "https://...",
  "email": "doctor@clinic.com",
  "password": "optional_password",
  "role": "staff",
  "permissions": "{}"
}
```

### Update Staff

```
PUT /api/admin/staff/{id}
```

**Request Body:** Same as Create (partial update supported)

### Delete Staff

```
DELETE /api/admin/staff/{id}
```

Performs soft delete (sets `deleted_at` timestamp).

---

## Programs API

Manage medical programs and treatments.

### List Programs

```
GET /api/admin/programs
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| is_visible | string | Filter by visibility: `true`, `false` |
| limit | number | Results per page (default: 50) |
| offset | number | Pagination offset (default: 0) |

### Get Single Program

```
GET /api/admin/programs/{id}
```

### Create Program

```
POST /api/admin/programs
```

**Request Body:**
```json
{
  "title": "프로그램 제목",
  "description": "프로그램 설명",
  "pricing": {
    "base": 100000,
    "currency": "KRW"
  },
  "features": ["특징1", "특징2"],
  "sections": [
    {
      "title": "섹션 제목",
      "content": "섹션 내용"
    }
  ],
  "doctor_id": "doctor-uuid",
  "doctor_ids": ["uuid1", "uuid2"],
  "category": "카테고리",
  "treatable_conditions": ["증상1", "증상2"],
  "is_visible": true,
  "order_index": 1,
  "translations": {
    "en": { "title": "Program Title", "description": "..." }
  }
}
```

### Update Program

```
PUT /api/admin/programs/{id}
```

**Request Body:** Partial update supported - only include fields to update.

### Delete Program

```
DELETE /api/admin/programs/{id}
```

Performs soft delete.

---

## Posts API

Manage blog posts, news, and notices.

### List Posts

```
GET /api/admin/posts
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by type: `blog`, `news`, `notice` |
| status | string | Filter by status: `draft`, `published` |
| category | string | Filter by category |
| limit | number | Results per page (default: 50) |
| offset | number | Pagination offset (default: 0) |

### Get Single Post

```
GET /api/admin/posts/{id}
```

### Create Post

```
POST /api/admin/posts
```

**Request Body:**
```json
{
  "title": "게시글 제목",
  "slug": "post-slug",
  "content": "게시글 내용 (HTML 또는 Markdown)",
  "excerpt": "요약",
  "type": "blog",
  "status": "published",
  "category": "카테고리",
  "tags": "태그1,태그2",
  "featured_image": "https://...",
  "author_id": "author-uuid",
  "published_at": 1704067200
}
```

### Update Post

```
PUT /api/admin/posts/{id}
```

### Delete Post

```
DELETE /api/admin/posts/{id}
```

Performs soft delete.

---

## Pages API

Manage static pages.

### List Pages

```
GET /api/admin/pages
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| is_published | string | Filter by status: `true`, `false` |
| limit | number | Results per page (default: 50) |
| offset | number | Pagination offset (default: 0) |

### Get Single Page

```
GET /api/admin/pages/{id}
```

### Update Page

```
PUT /api/admin/pages/{id}
```

**Request Body:**
```json
{
  "title": "페이지 제목",
  "slug": "page-slug",
  "description": "페이지 설명",
  "is_published": true,
  "sections": [
    {
      "type": "hero",
      "content": { ... }
    }
  ],
  "translations": {
    "en": { "title": "Page Title" }
  }
}
```

### Delete Page

```
DELETE /api/admin/pages/{id}
```

Performs hard delete.

---

## Clinic Info API

Manage clinic basic information.

### Get Clinic Info

```
GET /api/admin/clinic-info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "병원명",
    "englishName": "Clinic Name",
    "phone": "02-1234-5678",
    "address": "서울시...",
    "addressEn": "Seoul...",
    "mapUrl": "https://map.kakao.com/...",
    "description": "병원 소개",
    "businessLicenseNumber": "123-45-67890",
    "representativeName": "대표자명",
    "representativeNameEn": "Representative",
    "bankInfo": "은행 정보",
    "hours": { ... },
    "logo": "https://...",
    "favicon": "https://...",
    "themeColor": "#3B82F6",
    "themeStyle": "modern"
  }
}
```

### Update Clinic Info

```
PUT /api/admin/clinic-info
```

**Request Body:** Partial update supported.
```json
{
  "name": "새 병원명",
  "phone": "02-9876-5432",
  "address": "새 주소",
  "themeColor": "#10B981"
}
```

---

## Hours API

Manage operating hours.

### Get Hours

```
GET /api/admin/hours
```

**Response:**
```json
{
  "success": true,
  "data": {
    "weekdays": "09:00 - 18:00",
    "saturday": "09:00 - 13:00",
    "lunch": "12:30 - 14:00",
    "closed": "일요일, 공휴일",
    "freeform": false,
    "freeformText": ""
  }
}
```

### Update Hours

```
PUT /api/admin/hours
```

**Request Body:**
```json
{
  "weekdays": "09:00 - 18:00",
  "saturday": "09:00 - 13:00",
  "lunch": "12:30 - 14:00",
  "closed": "일요일, 공휴일"
}
```

**Freeform Mode:**
```json
{
  "freeform": true,
  "freeformText": "평일 09:00-18:00\n토요일 09:00-13:00\n점심시간 12:30-14:00\n일요일/공휴일 휴진"
}
```

---

## API Key Management

### Get Current API Key Status

```
GET /api/admin/settings/api-key
```

**Response:**
```json
{
  "success": true,
  "hasApiKey": true,
  "preview": "cos_abc...xyz"
}
```

### Generate New API Key

```
POST /api/admin/settings/api-key
```

**Response:**
```json
{
  "success": true,
  "apiKey": "cos_FULL_API_KEY_HERE"
}
```

> **Important:** The full API key is only shown once. Store it securely.

### Revoke API Key

```
DELETE /api/admin/settings/api-key
```

---

## Best Practices for AI Integration

### 1. Always Verify Before Modifying

Before updating or deleting, always GET the resource first to verify it exists and understand its current state.

```bash
# First, get current state
curl GET /api/admin/staff/abc-123

# Then, update with confidence
curl PUT /api/admin/staff/abc-123 -d '{"name": "Updated Name"}'
```

### 2. Use Partial Updates

Only send fields that need to be changed. The API supports partial updates.

```bash
# Good: Only update what's needed
curl PUT /api/admin/programs/xyz -d '{"is_visible": true}'

# Avoid: Sending entire object when only one field changes
```

### 3. Handle Pagination

For large datasets, always implement pagination:

```bash
# Page 1
curl GET /api/admin/posts?limit=20&offset=0

# Page 2
curl GET /api/admin/posts?limit=20&offset=20
```

### 4. Respect Soft Deletes

Most resources use soft delete. Deleted items won't appear in list queries but may exist in the database.

### 5. JSON Fields

Some fields store JSON data as strings. Parse/stringify appropriately:

- `specialties` - JSON array of strings
- `pricing` - JSON object
- `features` - JSON array
- `sections` - JSON array of objects
- `translations` - JSON object keyed by locale
- `permissions` - JSON object

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing API key |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate entry (e.g., slug) |
| 500 | Server Error |

---

## Rate Limits

Currently no rate limits are enforced, but please:
- Avoid rapid successive calls
- Batch operations when possible
- Cache responses where appropriate

---

*Last Updated: 2026-02-03*
*Version: 1.0.0*
