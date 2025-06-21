FULL CORRENT DATABASE SCHEMA


#	table_name
1	webhook_events
2	videos
3	video_summaries
4	video_segments
5	user_credit_audit
6	video_takeaways
7	usage_tracking
8	credit_transactions
9	users
10	subscriptions
11	payments
12	failed_webhooks
13	user_subscription_summary




[{
  "table_name": "credit_transactions",
  "column_name": "id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "credit_transactions",
  "column_name": "user_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "credit_transactions",
  "column_name": "amount",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "credit_transactions",
  "column_name": "type",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "credit_transactions",
  "column_name": "description",
  "data_type": "text",
  "is_nullable": "YES"
}, {
  "table_name": "credit_transactions",
  "column_name": "reference_id",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "credit_transactions",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "credit_transactions",
  "column_name": "updated_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "failed_webhooks",
  "column_name": "id",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "failed_webhooks",
  "column_name": "event_type",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "failed_webhooks",
  "column_name": "event_data",
  "data_type": "jsonb",
  "is_nullable": "NO"
}, {
  "table_name": "failed_webhooks",
  "column_name": "error_message",
  "data_type": "text",
  "is_nullable": "YES"
}, {
  "table_name": "failed_webhooks",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "failed_webhooks",
  "column_name": "processed",
  "data_type": "boolean",
  "is_nullable": "YES"
}, {
  "table_name": "payments",
  "column_name": "id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "payments",
  "column_name": "user_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "payments",
  "column_name": "subscription_id",
  "data_type": "uuid",
  "is_nullable": "YES"
}, {
  "table_name": "payments",
  "column_name": "stripe_payment_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "payments",
  "column_name": "amount",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "payments",
  "column_name": "currency",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "payments",
  "column_name": "status",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "payments",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "subscriptions",
  "column_name": "id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "subscriptions",
  "column_name": "user_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "subscriptions",
  "column_name": "stripe_subscription_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "subscriptions",
  "column_name": "stripe_price_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "subscriptions",
  "column_name": "status",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "subscriptions",
  "column_name": "current_period_start",
  "data_type": "timestamp with time zone",
  "is_nullable": "NO"
}, {
  "table_name": "subscriptions",
  "column_name": "current_period_end",
  "data_type": "timestamp with time zone",
  "is_nullable": "NO"
}, {
  "table_name": "subscriptions",
  "column_name": "cancel_at_period_end",
  "data_type": "boolean",
  "is_nullable": "YES"
}, {
  "table_name": "subscriptions",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "subscriptions",
  "column_name": "updated_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "subscriptions",
  "column_name": "polar_product_id",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "subscriptions",
  "column_name": "provider",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "usage_tracking",
  "column_name": "id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "usage_tracking",
  "column_name": "user_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "usage_tracking",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "usage_tracking",
  "column_name": "video_id",
  "data_type": "uuid",
  "is_nullable": "YES"
}, {
  "table_name": "usage_tracking",
  "column_name": "summary_id",
  "data_type": "uuid",
  "is_nullable": "YES"
}, {
  "table_name": "usage_tracking",
  "column_name": "tokens_used",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "usage_tracking",
  "column_name": "credits_used",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "usage_tracking",
  "column_name": "action_type",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "user_credit_audit",
  "column_name": "user_id",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_credit_audit",
  "column_name": "action_type",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_credit_audit",
  "column_name": "credits_used",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "user_credit_audit",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "user_credit_audit",
  "column_name": "video_title",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_credit_audit",
  "column_name": "youtube_video_id",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_credit_audit",
  "column_name": "video_status",
  "data_type": "text",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "id",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "email",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "full_name",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "subscription_tier",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "subscription_status",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "subscription_end_date",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "subscription_id",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "credits_used",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "credits_reserved",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "credits_limit",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "last_credit_reset",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "updated_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "usage_percentage",
  "data_type": "numeric",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "remaining_credits",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "user_subscription_summary",
  "column_name": "is_over_limit",
  "data_type": "boolean",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "users",
  "column_name": "email",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "users",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "updated_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "full_name",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "customer_id",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "subscription_status",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "subscription_tier",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "subscription_end_date",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "subscription_id",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "credits_used",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "last_credit_reset",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "users",
  "column_name": "credits_reserved",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_segments",
  "column_name": "id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "video_segments",
  "column_name": "video_id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "video_segments",
  "column_name": "segment_number",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_segments",
  "column_name": "title",
  "data_type": "text",
  "is_nullable": "NO"
}, {
  "table_name": "video_segments",
  "column_name": "start_time",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_segments",
  "column_name": "end_time",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_segments",
  "column_name": "hook",
  "data_type": "text",
  "is_nullable": "YES"
}, {
  "table_name": "video_segments",
  "column_name": "summary",
  "data_type": "text",
  "is_nullable": "NO"
}, {
  "table_name": "video_segments",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "video_segments",
  "column_name": "updated_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "video_summaries",
  "column_name": "id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "video_id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "main_title",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "overall_summary",
  "data_type": "text",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "video_summaries",
  "column_name": "updated_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "video_summaries",
  "column_name": "raw_ai_output",
  "data_type": "text",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "transcript_sent",
  "data_type": "text",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "prompt_tokens",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "completion_tokens",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "total_tokens",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "input_cost",
  "data_type": "numeric",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "output_cost",
  "data_type": "numeric",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "total_cost",
  "data_type": "numeric",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "video_duration_seconds",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_summaries",
  "column_name": "processing_status",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "video_takeaways",
  "column_name": "id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "video_takeaways",
  "column_name": "video_id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "video_takeaways",
  "column_name": "takeaway",
  "data_type": "text",
  "is_nullable": "NO"
}, {
  "table_name": "video_takeaways",
  "column_name": "order_index",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "video_takeaways",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "video_takeaways",
  "column_name": "updated_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "videos",
  "column_name": "id",
  "data_type": "uuid",
  "is_nullable": "NO"
}, {
  "table_name": "videos",
  "column_name": "user_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "videos",
  "column_name": "video_id",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "videos",
  "column_name": "title",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "videos",
  "column_name": "description",
  "data_type": "text",
  "is_nullable": "YES"
}, {
  "table_name": "videos",
  "column_name": "thumbnail_url",
  "data_type": "text",
  "is_nullable": "YES"
}, {
  "table_name": "videos",
  "column_name": "channel_title",
  "data_type": "character varying",
  "is_nullable": "YES"
}, {
  "table_name": "videos",
  "column_name": "duration",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "videos",
  "column_name": "view_count",
  "data_type": "integer",
  "is_nullable": "YES"
}, {
  "table_name": "videos",
  "column_name": "publish_date",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "videos",
  "column_name": "created_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "videos",
  "column_name": "updated_at",
  "data_type": "timestamp with time zone",
  "is_nullable": "YES"
}, {
  "table_name": "webhook_events",
  "column_name": "id",
  "data_type": "integer",
  "is_nullable": "NO"
}, {
  "table_name": "webhook_events",
  "column_name": "idempotency_key",
  "data_type": "character varying",
  "is_nullable": "NO"
}, {
  "table_name": "webhook_events",
  "column_name": "created_at",
  "data_type": "timestamp without time zone",
  "is_nullable": "YES"
}]

#	table_name	column_name
1	users	id
2	videos	id
3	video_summaries	id
4	subscriptions	id
5	payments	id
6	usage_tracking	id
7	failed_webhooks	id
8	webhook_events	id
9	video_segments	id
10	video_takeaways	id
11	credit_transactions	id



#	table_name	column_name	foreign_table_name	foreign_column_name
1	videos	user_id	users	id
2	subscriptions	user_id	users	id
3	payments	user_id	users	id
4	payments	subscription_id	subscriptions	id
5	usage_tracking	user_id	users	id
6	video_summaries	video_id	videos	id
7	usage_tracking	video_id	videos	id
8	usage_tracking	summary_id	video_summaries	id
9	video_segments	video_id	videos	id
10	video_takeaways	video_id	videos	id
11	credit_transactions	user_id	users	id


