-- Seed: topics and fallback vocabulary
-- Run after migration 0002 is applied.

-- Topics
INSERT OR IGNORE INTO topics (key, label_en, label_vi, label_ja, label_ko, label_th, label_zh, label_fr, label_de) VALUES
('travel', 'Travel', 'Du lịch', '旅行', '여행', 'ท่องเที่ยว', '旅行', 'Voyage', 'Reisen'),
('food', 'Food & Drink', 'Ăn uống', '食べ物＆飲み物', '음식 & 음료', 'อาหาร & เครื่องดื่ม', '饮食', 'Nourriture & Boissons', 'Essen & Trinken'),
('work', 'Work & Business', 'Công việc & Kinh doanh', '仕事＆ビジネス', '일 & 비즈니스', 'งาน & ธุรกิจ', '工作与商务', 'Travail & Affaires', 'Arbeit & Geschäft'),
('education', 'Education', 'Giáo dục', '教育', '교육', 'การศึกษา', '教育', 'Éducation', 'Bildung'),
('health', 'Health', 'Sức khỏe', '健康', '건강', 'สุขภาพ', '健康', 'Santé', 'Gesundheit'),
('technology', 'Technology', 'Công nghệ', 'テクノロジー', '기술', 'เทคโนโลยี', '科技', 'Technologie', 'Technologie'),
('shopping', 'Shopping', 'Mua sắm', 'ショッピング', '쇼핑', 'ช้อปปิ้ง', '购物', 'Shopping', 'Einkaufen'),
('entertainment', 'Entertainment', 'Giải trí', 'エンターテイメント', '엔터테인먼트', 'ความบันเทิง', '娱乐', 'Divertissement', 'Unterhaltung'),
('daily_life', 'Daily Life', 'Đời sống hàng ngày', '日常生活', '일상 생활', 'ชีวิตประจำวัน', '日常生活', 'Vie quotidienne', 'Alltag'),
('nature', 'Nature & Environment', 'Thiên nhiên & Môi trường', '自然＆環境', '자연 & 환경', 'ธรรมชาติ & สิ่งแวดล้อม', '自然与环境', 'Nature & Environnement', 'Natur & Umwelt');

-- Fallback pairs: en|vi|travel|A1
INSERT OR IGNORE INTO fallback_pairs (source_lang, target_lang, topic, level, source, target, example_source, example_target, ipa, pos, is_phrase) VALUES
('en', 'vi', 'travel', 'A1', 'airport', 'sân bay', 'The airport is far from here.', 'Sân bay ở xa đây.', '/ˈeə.pɔːt/', 'noun', 0),
('en', 'vi', 'travel', 'A1', 'ticket', 'vé', 'I need to buy a ticket.', 'Tôi cần mua một chiếc vé.', '/ˈtɪk.ɪt/', 'noun', 0),
('en', 'vi', 'travel', 'A1', 'passport', 'hộ chiếu', 'Show your passport at the counter.', 'Xuất trình hộ chiếu tại quầy.', '/ˈpɑːs.pɔːt/', 'noun', 0),
('en', 'vi', 'travel', 'A1', 'hotel room', 'phòng khách sạn', 'The hotel room is very clean.', 'Phòng khách sạn rất sạch.', '/həʊˈtel ruːm/', 'noun phrase', 1),
('en', 'vi', 'travel', 'A1', 'boarding pass', 'thẻ lên máy bay', 'Please have your boarding pass ready.', 'Vui lòng chuẩn bị sẵn thẻ lên máy bay.', '/ˈbɔː.dɪŋ ˌpɑːs/', 'noun phrase', 1),
('en', 'vi', 'travel', 'A1', 'luggage', 'hành lý', 'Where can I collect my luggage?', 'Tôi có thể nhận hành lý ở đâu?', '/ˈlʌɡ.ɪdʒ/', 'noun', 0),
('en', 'vi', 'travel', 'A1', 'map', 'bản đồ', 'Do you have a map?', 'Bạn có bản đồ không?', '/mæp/', 'noun', 0),
('en', 'vi', 'travel', 'A1', 'train station', 'nhà ga', 'The train station is nearby.', 'Nhà ga ở gần đây.', '/treɪn ˈsteɪ.ʃən/', 'noun phrase', 1),
('en', 'vi', 'travel', 'A1', 'taxi', 'taxi', 'Let''s take a taxi.', 'Chúng ta hãy bắt taxi.', '/ˈtæk.si/', 'noun', 0),
('en', 'vi', 'travel', 'A1', 'check in', 'làm thủ tục nhận phòng', 'We need to check in before 3pm.', 'Chúng ta cần làm thủ tục nhận phòng trước 3 giờ.', '/tʃek ɪn/', 'phrasal verb', 1);

-- Fallback pairs: en|vi|food|A1
INSERT OR IGNORE INTO fallback_pairs (source_lang, target_lang, topic, level, source, target, example_source, example_target, ipa, pos, is_phrase) VALUES
('en', 'vi', 'food', 'A1', 'rice', 'cơm', 'I eat rice every day.', 'Tôi ăn cơm mỗi ngày.', '/raɪs/', 'noun', 0),
('en', 'vi', 'food', 'A1', 'water', 'nước', 'Can I have some water?', 'Cho tôi xin chút nước.', '/ˈwɔː.tər/', 'noun', 0),
('en', 'vi', 'food', 'A1', 'coffee', 'cà phê', 'I like Vietnamese coffee.', 'Tôi thích cà phê Việt Nam.', '/ˈkɒf.i/', 'noun', 0),
('en', 'vi', 'food', 'A1', 'noodle soup', 'phở', 'This noodle soup is delicious.', 'Món phở này rất ngon.', '/ˈnuː.dəl suːp/', 'noun phrase', 1),
('en', 'vi', 'food', 'A1', 'chicken', 'gà', 'I ordered grilled chicken.', 'Tôi đã gọi gà nướng.', '/ˈtʃɪk.ɪn/', 'noun', 0),
('en', 'vi', 'food', 'A1', 'breakfast', 'bữa sáng', 'What time is breakfast?', 'Mấy giờ ăn sáng?', '/ˈbrek.fəst/', 'noun', 0),
('en', 'vi', 'food', 'A1', 'delicious', 'ngon', 'This food is very delicious.', 'Món này rất ngon.', '/dɪˈlɪʃ.əs/', 'adjective', 0),
('en', 'vi', 'food', 'A1', 'menu', 'thực đơn', 'Can I see the menu?', 'Cho tôi xem thực đơn.', '/ˈmen.juː/', 'noun', 0),
('en', 'vi', 'food', 'A1', 'bill', 'hóa đơn', 'Could I have the bill please?', 'Cho tôi xin hóa đơn.', '/bɪl/', 'noun', 0),
('en', 'vi', 'food', 'A1', 'street food', 'đồ ăn đường phố', 'Street food is very popular here.', 'Đồ ăn đường phố rất phổ biến ở đây.', '/striːt fuːd/', 'noun phrase', 1);

-- Generic fallback pairs (used when no specific pair exists)
INSERT OR IGNORE INTO fallback_pairs (source_lang, target_lang, topic, level, source, target, example_source, example_target, ipa, pos, is_phrase) VALUES
('*', '*', '*', '*', 'hello', 'xin chào', 'Hello, how are you?', 'Xin chào, bạn khỏe không?', '/həˈləʊ/', 'interjection', 0),
('*', '*', '*', '*', 'thank you', 'cảm ơn', 'Thank you very much.', 'Cảm ơn bạn rất nhiều.', '/θæŋk juː/', 'phrase', 1),
('*', '*', '*', '*', 'goodbye', 'tạm biệt', 'Goodbye, see you tomorrow.', 'Tạm biệt, hẹn gặp lại ngày mai.', '/ɡʊdˈbaɪ/', 'interjection', 0),
('*', '*', '*', '*', 'please', 'làm ơn', 'Please help me.', 'Làm ơn giúp tôi.', '/pliːz/', 'adverb', 0),
('*', '*', '*', '*', 'sorry', 'xin lỗi', 'I am sorry for being late.', 'Xin lỗi vì tôi đến muộn.', '/ˈsɒr.i/', 'adjective', 0),
('*', '*', '*', '*', 'good morning', 'chào buổi sáng', 'Good morning everyone.', 'Chào buổi sáng mọi người.', '/ɡʊd ˈmɔː.nɪŋ/', 'phrase', 1),
('*', '*', '*', '*', 'good night', 'chúc ngủ ngon', 'Good night, sleep well.', 'Chúc ngủ ngon, ngủ ngon nhé.', '/ɡʊd naɪt/', 'phrase', 1),
('*', '*', '*', '*', 'yes', 'vâng', 'Yes, I understand.', 'Vâng, tôi hiểu rồi.', '/jes/', 'adverb', 0),
('*', '*', '*', '*', 'no', 'không', 'No, thank you.', 'Không, cảm ơn.', '/nəʊ/', 'adverb', 0),
('*', '*', '*', '*', 'how much', 'bao nhiêu', 'How much does this cost?', 'Cái này giá bao nhiêu?', '/haʊ mʌtʃ/', 'phrase', 1);
