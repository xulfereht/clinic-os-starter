
import os
import json
import glob

SEEDS_DIR = 'seeds'
OUTPUT_FILE = os.path.join(SEEDS_DIR, 'generated_faqs.sql')

# Data Mappings
TOPICS = {
    3: {'slug': 'digestive', 'title': '소화기 질환', 'summary': '위장병, 담적병 등 소화기 관련 질환입니다.'},
    5: {'slug': 'skin', 'title': '피부 질환', 'summary': '아토피, 여드름 등 피부 관련 질환입니다.'}
}

CONDITIONS = {
    2: {'name': '과민성 대장 증후군', 'slug': 'ibs', 'topic_id': 3},
    3: {'name': '만성 위염', 'slug': 'gastritis', 'topic_id': 3},
    5: {'name': '담적병', 'slug': 'damjeok', 'topic_id': 3},
    6: {'name': '변비', 'slug': 'constipation', 'topic_id': 3},
    7: {'name': '설사', 'slug': 'diarrhea', 'topic_id': 3},
    8: {'name': '아토피', 'slug': 'atopy', 'topic_id': 5},
    9: {'name': '습진', 'slug': 'eczema', 'topic_id': 5},
    10: {'name': '건선', 'slug': 'psoriasis', 'topic_id': 5},
    11: {'name': '두드러기', 'slug': 'urticaria', 'topic_id': 5},
    12: {'name': '여드름', 'slug': 'acne', 'topic_id': 5},
    58: {'name': '지루성 피부염', 'slug': 'seborrheic', 'topic_id': 5},
    59: {'name': '사마귀', 'slug': 'warts', 'topic_id': 5}
}

sql = ["-- Generated FAQ Seeds\n-- Run this after sample_clinic.sql\n"]

# 1. Insert Topics
for t_id, data in TOPICS.items():
    sql.append(f"INSERT OR IGNORE INTO topics (id, slug, title, summary) VALUES ({t_id}, '{data['slug']}', '{data['title']}', '{data['summary']}');")

# 2. Insert Conditions
for c_id, data in CONDITIONS.items():
    sql.append(f"INSERT OR IGNORE INTO topic_conditions (id, topic_id, slug, name) VALUES ({c_id}, {data['topic_id']}, '{data['slug']}', '{data['name']}');")

# 3. Process JSON Files
json_files = glob.glob(os.path.join(SEEDS_DIR, 'faq_*.json'))
faq_id_counter = 100

for file_path in json_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
            
        topic_id = content.get('topic_id')
        condition_id = content.get('condition_id')
        items = content.get('items', [])

        if not items:
            continue

        for item in items:
            faq_id = faq_id_counter
            faq_id_counter += 1
            
            question = item.get('question', '').replace("'", "''")
            answer_short = item.get('answer_short', '').replace("'", "''")
            answer_detail = item.get('answer_detail', '').replace("'", "''")
            cluster = item.get('cluster', 'General').replace("'", "''")
            
            # Simple slug generation: id + suffix
            slug = f"{faq_id}-faq" 

            # Insert Item
            sql.append(f"INSERT INTO faq_items (id, topic_id, condition_id, category, cluster, question, answer_short, answer_detail, status, slug) VALUES ({faq_id}, {topic_id}, {condition_id}, 'faq', '{cluster}', '{question}', '{answer_short}', '{answer_detail}', 'published', '{slug}');")
            
            # Insert Translation (Korean default)
            sql.append(f"INSERT INTO faq_translations (faq_id, locale, question, answer_short, answer_detail, status) VALUES ({faq_id}, 'ko', '{question}', '{answer_short}', '{answer_detail}', 'published');")

    except Exception as e:
        print(f"Error processing {file_path}: {e}")

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql))

print(f"Generated SQL to {OUTPUT_FILE}")
