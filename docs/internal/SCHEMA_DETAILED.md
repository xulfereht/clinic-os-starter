# Database Schema (Detailed)

> 컬럼 타입과 제약조건을 포함한 상세 스키마
> Last updated: 2026-01-30

---

## admin_favorites

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| admin_id | TEXT | NOT NULL |
| path | TEXT | NOT NULL |
| label | TEXT | NOT NULL |
| icon | TEXT | - |
| display_order | INT | DEFAULT |
| created_at | INT | - |

## admin_messages
> 관리자 메시지

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| sender_id | TEXT | NOT NULL |
| recipient_id | TEXT | - |
| content | TEXT | - |
| file_url | TEXT | - |
| file_type | TEXT | - |
| created_at | INT | DEFAULT |
| channel_id | TEXT | - |
| deleted_at | INT | - |
| file_name | TEXT | - |

## admins
> 관리자 계정

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| email | TEXT | NOT NULL |
| password_hash | TEXT | NOT NULL |
| is_active | BOOL | DEFAULT |
| permissions | TEXT | - |
| staff | LAST_SEEN | - |
| updated_at | INT | DEFAULT |
| deleted_at | INT | DEFAULT |

## aeo_logs

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| timestamp | DATETIME | DEFAULT |
| bot_type | TEXT | - |
| Unknown | USER_AGENT | - |
| path | TEXT | - |
| ip_address | TEXT | - |
| referer | TEXT | - |
| status_code | INT | - |

## ai_configs

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| provider | TEXT | NOT NULL |
| api_key | TEXT | - |
| model | TEXT | - |
| is_active | INT | DEFAULT |
| organization_id | TEXT | - |
| base_url | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## analytics_events

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| session_id | TEXT | NOT NULL |
| event_type | TEXT | NOT NULL |
| event_data | TEXT | - |
| created_at | TEXT | DEFAULT |
| visitor_id | TEXT | - |

## business_lines

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| code | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| description | TEXT | - |
| default_care_mode | TEXT | DEFAULT |
| kpi_config_json | TEXT | - |
| campaign_config_json | TEXT | - |
| sort_order | INT | DEFAULT |
| is_active | INT | DEFAULT |
| created_at | INT | DEFAULT |

## campaign_runs

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| started_at | INT | - |
| failed | TOTAL_COUNT | DEFAULT |
| sent_count | INT | DEFAULT |
| failed_count | INT | DEFAULT |
| trigger_type | TEXT | - |
| TRIGGER | LOG_DETAILS | - |

**Foreign Keys:**
- `campaign_id` → `campaigns.id`

## campaigns
> 마케팅 캠페인

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| name | TEXT | NOT NULL |
| template_id | INT | NOT NULL |
| segment_id | INT | - |
| sent_count | INT | DEFAULT |
| failed_count | INT | DEFAULT |
| created_at | INT | DEFAULT |
| sent_at | INT | - |
| type | TEXT | DEFAULT |
| trigger_type | TEXT | - |
| trigger_config | TEXT | - |
| start_at | INT | - |
| end_at | INT | - |
| last_processed_id | INT | DEFAULT |
| next_run_at | INT | - |
| batch_size | INT | DEFAULT |
| is_active | INT | DEFAULT |
| trigger_event | TEXT | - |

**Foreign Keys:**
- `template_id` → `message_templates.id`
- `segment_id` → `segments.id`

## channel_members

| Column | Type | Constraints |
|--------|------|-------------|
| channel_id | TEXT | NOT NULL |
| user_id | TEXT | NOT NULL |
| last_read_at | INT | DEFAULT |
| joined_at | INT | NOT NULL |
| is_hidden | INT | DEFAULT |

**Foreign Keys:**
- `channel_id` → `channels.id`
- `user_id` → `staff.id`

## channels
> 채팅 채널

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| type | TEXT | NOT NULL, DEFAULT |
| group | NAME | - |
| last_message_at | INT | - |
| created_at | INT | NOT NULL |
| lead_id | TEXT | - |
| source | TEXT | DEFAULT |
| status | TEXT | DEFAULT |
| last_message | TEXT | - |
| translation_enabled | BOOL | DEFAULT |

## chatbot_nodes

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| parent_id | TEXT | - |
| action | TITLE | - |
| restart | ACTION_DATA | - |
| enabled | INT | DEFAULT |
| program_id | TEXT | - |

## chatbot_sessions
> 챗봇 세션

| Column | Type | Constraints |
|--------|------|-------------|
| channel_id | TEXT | PK |
| current_node_id | TEXT | DEFAULT |
| history | TEXT | - |

## chatbot_settings

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, DEFAULT |
| enabled | INT | DEFAULT |
| mode | TEXT | DEFAULT |
| outside_hours | GREETING | DEFAULT |
| fallback_message | TEXT | DEFAULT |
| away_message | TEXT | DEFAULT |
| response_delay | INT | DEFAULT |
| work_hours_end | TEXT | DEFAULT |
| work_days | TEXT | DEFAULT |

## checklists

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| deleted_at | INT | DEFAULT |

## clinic_holidays

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| date | TEXT | NOT NULL |
| description | TEXT | - |
| created_at | INT | DEFAULT |

## clinic_special_work_days

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| date | TEXT | NOT NULL |
| description | TEXT | - |
| created_at | INT | DEFAULT |

## clinic_weekly_schedules

| Column | Type | Constraints |
|--------|------|-------------|
| day_of_week | INT | PK |
| is_closed | INT | DEFAULT |
| open_time | TEXT | - |
| close_time | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## clinical_tests

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| test_type | TEXT | NOT NULL |
| test_date | INT | - |
| data | TEXT | - |
| images | TEXT | - |
| note | TEXT | - |
| created_at | INT | DEFAULT |
| deleted_at | INT | DEFAULT |

## clinics
> 병원 정보

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| deleted_at | INT | DEFAULT |
| theme_style | TEXT | DEFAULT |
| logo_url | TEXT | - |
| favicon_url | TEXT | - |
| name | TEXT | - |
| address | TEXT | - |
| phone | TEXT | - |
| hours | TEXT | - |
| theme_color | TEXT | - |
| updated_at | INT | DEFAULT |
| theme_config | TEXT | - |
| map_url | TEXT | - |
| business_license_number | TEXT | - |
| representative_name | TEXT | - |
| description | TEXT | - |
| ai_config | TEXT | - |
| integrations | TEXT | - |
| analytics_config | TEXT | - |
| bank_info | TEXT | DEFAULT |

## condition_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| condition_id | INT | NOT NULL |
| locale | TEXT | NOT NULL |
| name | TEXT | - |
| description | TEXT | - |
| status | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## consent_log

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | - |
| consent_type | TEXT | NOT NULL |
| consent | BOOL | NOT NULL |
| channels | TEXT | - |
| consent_version | TEXT | - |
| consent_text_snapshot | TEXT | - |
| term_version_id | TEXT | - |
| source | TEXT | NOT NULL |
| ip_address | TEXT | - |
| user_agent | TEXT | - |
| created_at | INT | DEFAULT |

## contact_history

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| field | TEXT | NOT NULL |
| old_value | TEXT | - |
| new_value | TEXT | NOT NULL |
| changed_at | INT | DEFAULT |
| changed_by | TEXT | - |
| reason | TEXT | - |

**Foreign Keys:**
- `patient_id` → `patients.id`

## d1_migrations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| name | TEXT | NOT NULL |
| applied_at | TEXT | DEFAULT |

## data_converters

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| description | TEXT | - |
| target_type | TEXT | NOT NULL |
| leads | CONFIG | NOT NULL |
| updated_at | INT | NOT NULL |

## doctors

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| role | TEXT | - |
| bio | TEXT | - |
| image | TEXT | - |
| specialties | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| education | TEXT | - |
| career | TEXT | - |

## documents

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| filename | TEXT | NOT NULL |
| url | TEXT | NOT NULL |
| size | INT | NOT NULL |
| mime_type | TEXT | NOT NULL |
| category | TEXT | DEFAULT |
| uploaded_at | INT | NOT NULL |
| description | TEXT | - |
| metadata | TEXT | - |

## event_campaigns

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| slug | TEXT | NOT NULL |
| title | TEXT | NOT NULL |
| description | TEXT | - |
| products | TEXT | - |
| created_at | DATETIME | DEFAULT |
| updated_at | DATETIME | DEFAULT |

## expense_categories

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| name | TEXT | NOT NULL |
| color | TEXT | DEFAULT |

## expense_requests
> 지출 요청

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| request_date | TEXT | NOT NULL |
| REJECTED | IS_PAID | DEFAULT |
| updated_at | INT | DEFAULT |

## expense_templates

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| name | TEXT | NOT NULL |
| account_number | TEXT | - |
| account_holder | TEXT | - |
| created_at | INT | DEFAULT |

## faq_items
> FAQ

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| topic_id | INT | NOT NULL |
| question | TEXT | NOT NULL |
| answer_short | TEXT | - |
| supervisor_id | TEXT | - |
| status | TEXT | DEFAULT |
| published | VIEW_COUNT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| last_reviewed_at | INT | - |
| category | TEXT | - |
| condition_id | INT | - |
| slug | TEXT | - |
| cluster | TEXT | - |
| is_sample | INT | DEFAULT |

**Foreign Keys:**
- `topic_id` → `topics.id`

## faq_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| faq_id | INT | NOT NULL |
| published | PRIORITY | DEFAULT |
| reviewer_id | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| tags | TEXT | - |

**Foreign Keys:**
- `faq_id` → `faq_items.id`

## intake_submissions

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| intake_data | TEXT | NOT NULL |
| submitted_at | INT | NOT NULL |
| status | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| deleted_at | INT | DEFAULT |

**Foreign Keys:**
- `patient_id` → `patients.id`

## intakes

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| deleted_at | INT | DEFAULT |

## inventory_items
> 재고 품목

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| category | TEXT | - |
| vendor_id | TEXT | - |
| stock_level | INT | DEFAULT |
| min_stock_level | INT | DEFAULT |
| unit | TEXT | DEFAULT |
| location | TEXT | - |
| memo | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| deleted_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |

## inventory_transactions
> 재고 변동

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| item_id | TEXT | NOT NULL |
| quantity_change | INT | NOT NULL |
| reason | TEXT | - |
| created_by | TEXT | - |
| created_at | INT | DEFAULT |
| transaction_date | INT | - |
| type | TEXT | DEFAULT |

## kakao_messages

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| kakao_user_id | TEXT | NOT NULL |
| message_type | TEXT | DEFAULT |

**Foreign Keys:**
- `kakao_user_id` → `kakao_users.id`

## kakao_users

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| kakao_user_id | TEXT | NOT NULL |
| last_message_at | INT | - |
| message_count | INT | DEFAULT |
| created_at | INT | DEFAULT |

**Foreign Keys:**
- `patient_id` → `patients.id`

## knowledge_cards

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| topic | TEXT | NOT NULL |
| card_type | TEXT | NOT NULL |
| Risk | MANAGEMENT | NOT NULL |
| All | TAGS | - |
| L3 | CONTENT | NOT NULL |
| archived | CREATED_AT | DEFAULT |
| updated_at | INT | DEFAULT |
| created_by | TEXT | - |
| category | TEXT | DEFAULT |
| revision_note | TEXT | DEFAULT |
| is_sample | INT | DEFAULT |

## knowledge_categories

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| description | TEXT | - |
| is_enabled | BOOL | DEFAULT |
| display_order | INT | DEFAULT |
| created_at | INT | - |
| updated_at | INT | - |

## knowledge_interactions

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| staff_id | TEXT | NOT NULL |
| card_id | TEXT | NOT NULL |
| type | TEXT | NOT NULL |
| not_helpful | CREATED_AT | DEFAULT |

**Foreign Keys:**
- `card_id` → `knowledge_cards.id`

## lead_events

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| lead_id | TEXT | NOT NULL |
| type | TEXT | NOT NULL |
| content | TEXT | - |
| created_by | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| staff_id | TEXT | - |

**Foreign Keys:**
- `lead_id` → `leads.id`

## leads
> 리드/문의

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| contact | TEXT | NOT NULL |
| consent | BOOL | NOT NULL, DEFAULT |
| summary | TEXT | - |
| risk_flags | TEXT | - |
| channel | TEXT | DEFAULT |
| status | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| type | TEXT | DEFAULT |
| patient_type | TEXT | DEFAULT |
| symptoms | TEXT | - |
| visit_date | TEXT | - |
| notes | TEXT | - |
| patient_id | TEXT | - |
| closed_at | INT | - |
| intake_data | TEXT | - |
| updated_at | INT | - |
| channel_id | TEXT | - |
| user_agent | TEXT | - |
| ip_address | TEXT | - |
| location | TEXT | - |
| device_type | TEXT | - |
| referrer | TEXT | - |
| last_seen | INT | - |
| consulting_at | INT | - |
| deleted_at | INT | DEFAULT |
| tags | TEXT | - |
| dedupe_key | TEXT | - |
| provider_msg_id | TEXT | - |
| source_data | TEXT | - |
| language | TEXT | DEFAULT |
| is_sample | INT | DEFAULT |

## manual_pages

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| title | TEXT | NOT NULL |
| content | TEXT | - |
| category | TEXT | - |
| updated_by | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |

## message_logs

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| campaign_id | INT | - |
| patient_id | TEXT | - |
| phone | TEXT | NOT NULL |
| content | TEXT | - |
| status | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| sent_at | INT | - |
| lead_id | TEXT | - |
| channel_id | TEXT | - |
| admin_id | TEXT | - |
| type | TEXT | DEFAULT |
| patient_name | TEXT | - |
| message_type | TEXT | DEFAULT |
| result_code | TEXT | - |
| deleted_at | INT | DEFAULT |

**Foreign Keys:**
- `campaign_id` → `campaigns.id`
- `patient_id` → `patients.id`

## message_reads

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| message_id | TEXT | NOT NULL |
| reader_id | TEXT | NOT NULL |
| read_at | INT | NOT NULL |

## message_templates
> 메시지 템플릿

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| name | TEXT | NOT NULL |
| content | TEXT | NOT NULL |
| segment_id | INT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| alimtalk_code | TEXT | - |
| buttons | TEXT | - |
| category | TEXT | DEFAULT |
| approval_status | TEXT | - |
| alimtalk_status | TEXT | DEFAULT |

**Foreign Keys:**
- `segment_id` → `segments.id`

## message_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| message_id | TEXT | NOT NULL |
| locale | TEXT | NOT NULL |
| translated_text | TEXT | NOT NULL |
| created_at | INT | DEFAULT |
| engine | TEXT | DEFAULT |
| confidence | REAL | DEFAULT |

**Foreign Keys:**
- `message_id` → `admin_messages.id`

## notices
> 공지사항

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| title | TEXT | NOT NULL |
| content | TEXT | NOT NULL |
| category | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## page_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| page_type | TEXT | NOT NULL |
| static | PAGE_ID | NOT NULL |
| published | PRIORITY | DEFAULT |
| reviewer_id | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| published_at | INT | - |

## page_views

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| session_id | TEXT | NOT NULL |
| path | TEXT | NOT NULL |
| referrer | TEXT | - |
| user_agent | TEXT | - |
| ip_hash | TEXT | - |
| country | TEXT | - |
| device_type | TEXT | - |
| desktop | CREATED_AT | DEFAULT |
| visitor_id | TEXT | - |

## pages
> 정적 페이지

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| slug | TEXT | NOT NULL |
| title | TEXT | NOT NULL |
| description | TEXT | - |
| sections | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## patient_events

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| type | TEXT | NOT NULL |
| title | TEXT | - |
| content | TEXT | - |
| event_date | INT | - |
| created_at | INT | DEFAULT |
| staff_id | TEXT | - |
| care_mode | TEXT | DEFAULT |
| business_type | TEXT | DEFAULT |
| deleted_at | INT | - |

**Foreign Keys:**
- `patient_id` → `patients.id`

## patient_images

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| file_name | TEXT | - |
| mime_type | TEXT | - |
| data | TEXT | - |
| size | INT | - |
| uploaded_at | INT | DEFAULT |
| description | TEXT | - |

**Foreign Keys:**
- `patient_id` → `patients.id`

## patient_labels

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| patient_id | TEXT | NOT NULL |
| category | TEXT | NOT NULL |
| value | TEXT | NOT NULL |
| is_active | BOOL | DEFAULT |
| created_at | INT | DEFAULT |
| created_by | TEXT | - |

**Foreign Keys:**
- `patient_id` → `patients.id`

## patient_tags

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| color | TEXT | DEFAULT |
| created_at | INT | - |
| deleted_at | INT | DEFAULT |
| category | TEXT | DEFAULT |

## patients
> 환자 정보

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_number | INT | - |
| name | TEXT | NOT NULL |
| name_english | TEXT | - |
| birth_date | TEXT | - |
| gender | TEXT | - |
| current_phone | TEXT | NOT NULL |
| current_email | TEXT | - |
| address | TEXT | - |
| emergency_contact | TEXT | - |
| emergency_phone | TEXT | - |
| source | TEXT | DEFAULT |
| channel | TEXT | - |
| referral_source | TEXT | - |
| has_account | BOOL | DEFAULT |
| password_hash | TEXT | - |
| email_verified | BOOL | DEFAULT |
| role | TEXT | DEFAULT |
| status | TEXT | DEFAULT |
| tier | TEXT | DEFAULT |
| first_visit_date | TEXT | - |
| last_visit_date | TEXT | - |
| last_contact_date | TEXT | - |
| visit_count | INT | DEFAULT |
| primary_doctor | TEXT | - |
| assigned_staff | TEXT | - |
| preferred_time | TEXT | - |
| sms_consent | BOOL | DEFAULT |
| email_consent | BOOL | DEFAULT |
| notes | TEXT | - |
| tags | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| member_id | TEXT | - |
| total_payment | INT | DEFAULT |
| average_transaction | INT | DEFAULT |
| region | TEXT | - |
| occupation | TEXT | - |
| referral_detail | TEXT | - |
| consultant_id | TEXT | - |
| next_contact_date | INT | - |
| last_contact_type | TEXT | - |
| marketing_consent_date | INT | - |
| campaign_id | TEXT | - |
| zipcode | TEXT | - |
| address_road | TEXT | - |
| address_detail | TEXT | - |
| referrer_id | TEXT | - |
| segments | TEXT | DEFAULT |
| first_source | TEXT | - |
| chart_number | TEXT | - |
| legacy_medical_history | TEXT | - |
| deleted_at | INT | DEFAULT |
| last_activity_at | INT | DEFAULT |
| lifecycle_stage | TEXT | DEFAULT |
| address_zip | TEXT | - |
| payment_count | INT | DEFAULT |
| last_shipping_date | TEXT | - |
| is_sample | INT | DEFAULT |

**Foreign Keys:**
- `primary_doctor` → `staff.id`

## payments
> 결제

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| product_id | TEXT | - |
| amount | INT | NOT NULL |
| status | TEXT | DEFAULT |
| paid_at | INT | DEFAULT |
| notes | TEXT | - |
| original_amount | INT | - |
| discount_amount | INT | DEFAULT |
| promotion_id | TEXT | - |
| quantity | INT | DEFAULT |
| shipping_status | TEXT | DEFAULT |
| shipping_courier | TEXT | - |
| shipping_tracking_number | TEXT | - |
| shipped_at | INT | - |
| delivered_at | INT | - |
| happy_call_status | TEXT | DEFAULT |
| happy_call_scheduled_at | INT | - |
| happy_call_completed_at | INT | - |
| happy_call_notes | TEXT | - |
| shipping_due_date | INT | - |
| revenue_line | TEXT | DEFAULT |
| deleted_at | INT | DEFAULT |
| refund_amount | INT | DEFAULT |
| refunded_at | INT | - |
| original_payment_id | TEXT | - |
| created_by | TEXT | - |
| created_at | INT | - |
| updated_at | INT | - |
| method | TEXT | DEFAULT |
| is_sample | INT | DEFAULT |

**Foreign Keys:**
- `patient_id` → `patients.id`
- `product_id` → `products.id`

## plugin_migrations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| plugin_id | TEXT | NOT NULL |
| version | TEXT | NOT NULL |
| migration_name | TEXT | NOT NULL |
| checksum | TEXT | - |
| applied_at | INT | DEFAULT |
| applied_by | TEXT | - |
| execution_time_ms | INT | - |
| status | TEXT | DEFAULT |
| error_message | TEXT | - |
| rollback_sql | TEXT | - |

## plugin_status

| Column | Type | Constraints |
|--------|------|-------------|
| plugin_id | TEXT | PK |
| enabled | INT | DEFAULT |
| settings | TEXT | DEFAULT |
| updated_at | INT | DEFAULT |

## plugin_storage

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| plugin_id | TEXT | NOT NULL |
| key | TEXT | NOT NULL |
| value | TEXT | - |
| created_at | INT | NOT NULL, DEFAULT |
| updated_at | INT | NOT NULL, DEFAULT |

## post_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| post_id | INT | NOT NULL |
| published | PRIORITY | DEFAULT |
| reviewer_id | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

**Foreign Keys:**
- `post_id` → `posts.id`

## posts
> 블로그/칼럼

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| title | TEXT | NOT NULL |
| slug | TEXT | - |
| content | TEXT | - |
| author_id | TEXT | - |
| type | TEXT | DEFAULT |
| status | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| doctor_id | TEXT | - |
| patient_id | TEXT | - |
| featured_image | TEXT | - |
| excerpt | TEXT | - |
| is_pinned | INT | DEFAULT |
| view_count | INT | DEFAULT |
| category | TEXT | - |
| patient_name | TEXT | - |
| deleted_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |
| show_popup | INT | DEFAULT |
| popup_start_date | INT | DEFAULT |
| popup_end_date | INT | DEFAULT |

**Foreign Keys:**
- `author_id` → `staff.id`

## products

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| category | TEXT | - |
| price | INT | DEFAULT |
| is_active | BOOL | DEFAULT |
| created_at | INT | DEFAULT |
| deleted_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |

## program_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| program_id | TEXT | NOT NULL |
| description | TEXT | - |
| pricing | TEXT | - |
| priority | INT | DEFAULT |
| reviewer_id | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

**Foreign Keys:**
- `program_id` → `programs.id`

## programs
> 진료 프로그램

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| title | TEXT | NOT NULL |
| description | TEXT | - |
| pricing | TEXT | - |
| features | TEXT | - |
| updated_at | INT | DEFAULT |
| sections | TEXT | - |
| doctor_id | TEXT | - |
| category | TEXT | DEFAULT |
| treatable_conditions | TEXT | DEFAULT |
| doctor_ids | TEXT | DEFAULT |
| is_visible | INT | DEFAULT |
| order_index | INT | DEFAULT |
| deleted_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |
| translations | TEXT | DEFAULT |

## promotions

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL |
| value | INT | NOT NULL |
| is_active | BOOL | DEFAULT |
| created_at | INT | DEFAULT |
| deleted_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |

## rate_limit_events

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| identifier | TEXT | NOT NULL |
| event_type | TEXT | NOT NULL |
| created_at | INT | NOT NULL |

## reservations
> 예약

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| doctor_id | TEXT | - |
| program_id | TEXT | - |
| reserved_at | INT | NOT NULL |
| status | TEXT | DEFAULT |
| cancel_reason | TEXT | - |
| notes | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| deleted_at | INT | DEFAULT |
| created_by | TEXT | - |
| is_sample | INT | DEFAULT |

**Foreign Keys:**
- `patient_id` → `patients.id`
- `doctor_id` → `staff.id`

## saved_diagnosis_results

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| template_id | TEXT | NOT NULL |
| member_id | TEXT | NOT NULL |
| answers | TEXT | - |
| result_summary | TEXT | - |
| created_at | INT | DEFAULT |

**Foreign Keys:**
- `template_id` → `self_diagnosis_templates.id`
- `member_id` → `web_members.id`

## segments
> 환자 세그먼트

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| name | TEXT | NOT NULL |
| description | TEXT | - |
| query_sql | TEXT | NOT NULL |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| criteria | TEXT | - |

## self_diagnosis_results

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| template_id | TEXT | NOT NULL |
| answers | TEXT | - |
| result_summary | TEXT | - |
| converted | INT | DEFAULT |
| created_at | INT | DEFAULT |

**Foreign Keys:**
- `template_id` → `self_diagnosis_templates.id`

## self_diagnosis_template_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| template_id | TEXT | NOT NULL |
| locale | TEXT | NOT NULL |
| title | TEXT | NOT NULL |
| disclaimer | TEXT | - |
| questions | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## self_diagnosis_templates

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| description | TEXT | - |
| type | TEXT | DEFAULT |
| program_id | TEXT | - |
| questions | TEXT | NOT NULL |
| calculation_script | TEXT | - |
| result_templates_json | TEXT | - |
| cta_config | TEXT | - |
| thumbnail_image | TEXT | - |
| estimated_time | INT | DEFAULT |
| status | TEXT | DEFAULT |
| order_index | INT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

**Foreign Keys:**
- `program_id` → `programs.id`

## sessions

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| member_id | TEXT | - |
| expires_at | INT | NOT NULL |
| created_at | INT | DEFAULT |

## settings
> 시스템 설정

| Column | Type | Constraints |
|--------|------|-------------|
| key | TEXT | PK |
| value | TEXT | - |
| updated_at | INT | DEFAULT |

## shipments

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| shipping_order_id | TEXT | NOT NULL |
| type | TEXT | DEFAULT |
| status | TEXT | DEFAULT |
| shipped_at | INT | DEFAULT |
| tracking_number | TEXT | - |
| notes | TEXT | - |
| deducted_quantity | INT | DEFAULT |
| created_at | INT | DEFAULT |
| sms_sent_at | INT | - |
| sms_status | TEXT | - |

**Foreign Keys:**
- `shipping_order_id` → `shipping_orders.id`

## shipping_orders

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| product_name | TEXT | - |
| total_quantity | INT | DEFAULT |
| remaining_quantity | INT | DEFAULT |
| last_shipped_at | INT | - |
| next_shipping_date | INT | - |
| status | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| message | TEXT | - |

**Foreign Keys:**
- `patient_id` → `patients.id`

## short_links

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| code | TEXT | NOT NULL |
| original_url | TEXT | NOT NULL |
| created_at | INT | NOT NULL |
| expires_at | INT | - |
| visits | INT | DEFAULT |

## site_settings
> 사이트 설정

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| category | TEXT | NOT NULL |
| key | TEXT | NOT NULL |
| value | TEXT | - |
| updated_at | INT | DEFAULT |

## staff
> 의료진/직원

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| role | TEXT | - |
| bio | TEXT | - |
| image | TEXT | - |
| specialties | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| education | TEXT | DEFAULT |
| career | TEXT | DEFAULT |
| position | TEXT | DEFAULT |
| order_index | INT | DEFAULT |
| type | TEXT | DEFAULT |
| department | TEXT | - |
| is_active | BOOL | DEFAULT |
| email | TEXT | - |
| password_hash | TEXT | - |
| permissions | TEXT | DEFAULT |
| last_seen | INT | - |
| join_date | TEXT | - |
| total_leaves | INT | DEFAULT |
| phone | TEXT | - |
| birth_date | TEXT | - |
| deleted_at | INT | DEFAULT |
| admin_role | TEXT | DEFAULT |
| name_en | TEXT | - |
| name_hanja | TEXT | - |
| is_sample | INT | DEFAULT |
| password_hash_format | TEXT | DEFAULT |
| password_salt | TEXT | - |
| failed_login_attempts | INT | DEFAULT |
| locked_until | INT | - |

## staff_leaves

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| staff_id | TEXT | NOT NULL |
| start_date | TEXT | NOT NULL |
| end_date | TEXT | NOT NULL |
| type | TEXT | DEFAULT |
| reason | TEXT | - |
| status | TEXT | DEFAULT |
| created_at | INT | DEFAULT |

## staff_schedules

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| staff_id | TEXT | NOT NULL |
| day_of_week | INT | NOT NULL |
| start_time | TEXT | - |
| end_time | TEXT | - |
| is_working | INT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## staff_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| staff_id | TEXT | NOT NULL |
| locale | TEXT | NOT NULL |
| name | TEXT | - |
| position | TEXT | - |
| bio | TEXT | - |
| education | TEXT | - |
| career | TEXT | - |
| specialties | TEXT | - |
| status | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## super_admins
> 슈퍼 관리자

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| email | TEXT | NOT NULL |
| password_hash | TEXT | NOT NULL |
| name | TEXT | - |
| is_active | INT | DEFAULT |
| password_change_required | INT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | - |
| password_hash_format | TEXT | DEFAULT |
| password_salt | TEXT | - |
| failed_login_attempts | INT | DEFAULT |
| locked_until | INT | - |

## supported_locales

| Column | Type | Constraints |
|--------|------|-------------|
| code | TEXT | PK |
| updated_at | INT | DEFAULT |

## survey_responses

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| patient_id | TEXT | NOT NULL |
| survey_type | TEXT | NOT NULL |
| response_data | TEXT | - |
| created_at | INT | DEFAULT |

**Foreign Keys:**
- `patient_id` → `patients.id`

## survey_results

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| survey_id | TEXT | NOT NULL |
| patient_id | TEXT | NOT NULL |
| responses | TEXT | - |
| submitted_at | INT | DEFAULT |

## surveys

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| label | TEXT | NOT NULL |
| description | TEXT | - |
| path_template | TEXT | NOT NULL |
| is_public | INT | DEFAULT |
| tags | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| definition | TEXT | - |
| deleted_at | INT | DEFAULT |

## system_manuals

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| title | TEXT | NOT NULL |
| category | TEXT | NOT NULL |
| content | TEXT | NOT NULL |
| sort_order | INT | DEFAULT |
| is_active | INT | DEFAULT |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## task_templates

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| title | TEXT | NOT NULL |
| description | TEXT | - |
| content | TEXT | - |
| subtasks | TEXT | DEFAULT |
| frequency | TEXT | DEFAULT |
| created_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |

## tasks
> 업무/태스크

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| title | TEXT | NOT NULL |
| description | TEXT | - |
| status | TEXT | DEFAULT |
| assignee_id | TEXT | - |
| due_date | INT | - |
| created_by | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| frequency | TEXT | DEFAULT |
| subtasks | TEXT | DEFAULT |
| content | TEXT | - |
| last_generated | INT | - |
| deleted_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |

## terms_definitions

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| slug | TEXT | NOT NULL |
| description | TEXT | - |
| created_at | INT | DEFAULT |

## terms_versions

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| term_id | TEXT | NOT NULL |
| version | TEXT | NOT NULL |
| effective_date | INT | - |
| created_at | INT | DEFAULT |
| locale | TEXT | DEFAULT |

**Foreign Keys:**
- `term_id` → `terms_definitions.id`

## topic_conditions

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| topic_id | INT | NOT NULL |
| slug | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| name_en | TEXT | - |
| description | TEXT | - |
| icon | TEXT | - |
| display_order | INT | DEFAULT |
| faq_count | INT | DEFAULT |
| created_at | INT | DEFAULT |

**Foreign Keys:**
- `topic_id` → `topics.id`

## topic_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| topic_id | INT | NOT NULL |
| published | CREATED_AT | DEFAULT |
| updated_at | INT | DEFAULT |
| seo_title | TEXT | - |

**Foreign Keys:**
- `topic_id` → `topics.id`

## topics

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| slug | TEXT | NOT NULL |
| title | TEXT | NOT NULL |
| summary | TEXT | - |
| manager_id | TEXT | - |
| cost | TAGS | - |
| updated_at | INT | DEFAULT |
| seo_title | TEXT | - |

## translation_history

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| content_type | TEXT | NOT NULL |
| staff | CONTENT_ID | NOT NULL |

## translation_progress

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| entity_type | TEXT | NOT NULL |
| ui | ENTITY_ID | NOT NULL |
| published | PROGRESS_PERCENT | DEFAULT |
| word_count | INT | DEFAULT |
| notes | TEXT | - |
| assigned_to | TEXT | - |
| due_date | INT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |

## ui_translations

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK |
| key | TEXT | NOT NULL |
| updated_at | INT | DEFAULT |

## vendor_notes

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| vendor_id | TEXT | NOT NULL |
| content | TEXT | NOT NULL |
| note_type | TEXT | DEFAULT |
| order | CREATED_BY | - |
| created_at | INT | DEFAULT |

**Foreign Keys:**
- `vendor_id` → `vendors.id`

## vendors

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| name | TEXT | NOT NULL |
| category | TEXT | - |
| contact_person | TEXT | - |
| phone | TEXT | - |
| email | TEXT | - |
| website | TEXT | - |
| bank_info | TEXT | - |
| memo | TEXT | - |
| created_at | INT | DEFAULT |
| updated_at | INT | DEFAULT |
| deleted_at | INT | DEFAULT |
| is_sample | INT | DEFAULT |

## web_members

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| email | TEXT | NOT NULL |
| password_hash | TEXT | NOT NULL |
| name | TEXT | - |
| phone | TEXT | - |
| birth_year | INT | - |
| email_verified | BOOL | DEFAULT |
| last_login_at | INT | - |
| login_count | INT | DEFAULT |
| marketing_consent | BOOL | DEFAULT |
| source | TEXT | - |
| created_at | INT | DEFAULT |
| patient_id | TEXT | - |

**Foreign Keys:**
- `patient_id` → `patients.id`

## webhook_logs

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK |
| received_at | INT | NOT NULL |
| source | TEXT | NOT NULL |
| payload_preview | TEXT | - |
| status | TEXT | NOT NULL |
| message | TEXT | - |
| lead_id | TEXT | - |
| created_at | INT | DEFAULT |
