const fs = require('fs');
const path = require('path');

// 1. Define the Translations Object (Copied from index.astro)
const tr = {
    hero: {
        badge: {
            ko: "전통의 지혜와 현대한의학의 통합",
            en: "Integration of Traditional Wisdom & Modern Science",
            ja: "伝統の知恵と現代韓医学の統合",
            "zh-hans": "传统智慧与现代韩医学的结合",
            vi: "Kết hợp Trí tuệ Truyền thống & Y học Hiện đại",
        },
        title: {
            ko: '쉼의 시간,<br/><span class="text-slate-900 relative inline-block">회복</span>의 공간',
            en: 'Time for Rest,<br/>Space for <span class="text-slate-900">Recovery</span>',
            ja: '休息の時間、<br/><span class="text-slate-900">回復</span>の空間',
            "zh-hans":
                '休憩的时间,<br/><span class="text-slate-900">恢复</span>的空间',
            vi: 'Thời gian Nghỉ ngơi,<br/>Không gian <span class="text-slate-900">Hồi phục</span>',
        },
        desc: {
            ko: '이곳저곳 다녀봐도 낫지 않던<br class="md:hidden"/> 만성 질환.<br class="hidden md:block"/><br class="md:hidden"/>백록담은 수치가 아닌,<br class="md:hidden"/> 몸 전체의 균형을 봅니다.',
            en: "Chronic pain that persists despite various treatments.<br/>We look beyond numbers to see your body's overall balance.",
            ja: "あちこち通っても治らなかった慢性の痛み。<br/>白鹿潭は数値ではなく、体全体のバランスを診ます。",
            "zh-hans":
                "四处求医却未能治愈的顽固疾病。<br/>白鹿潭不看数值，而是看身体整体的平衡。",
            vi: "Bệnh mãn tính chữa mãi không khỏi.<br/>Baekrokdam nhìn vào sự cân bằng toàn diện của cơ thể, không chỉ là các chỉ số.",
        },
        checkSymptoms: {
            ko: "내 증상 확인하기",
            en: "Check My Symptoms",
            ja: "症状をチェック",
            "zh-hans": "检查我的症状",
            vi: "Kiểm tra Triệu chứng",
        },
        bookAppointment: {
            ko: "진료 예약하기",
            en: "Book Appointment",
            ja: "診療予約",
            "zh-hans": "预约诊疗",
            vi: "Đặt Lịch Khám",
        },
    },
    bridge: {
        title: {
            ko: "검사지 너머,<br/>몸이 보내는 신호를 읽습니다.",
            en: "Beyond the Test Results,<br/>We Read Your Body's Signals",
            ja: "検査結果の向こう側、<br/>身体が送る信号を読み取ります",
            "zh-hans": "超越检查报告，<br/>解读身体发出的信号",
            vi: "Hơn Cả Kết Quả Xét Nghiệm,<br/>Chúng Tôi Đọc Tín Hiệu Cơ Thể Bạn",
        },
        description: {
            ko: "검사 결과는 정상.<br class='md:hidden'/> 그런데 왜 아직 힘드실까요?<br/><br class='md:hidden'/>동양의학의 지혜는<br class='md:hidden'/> 기계가 놓치는<br class='md:hidden'/> 미세한 불균형을 읽어냅니다.<br/><br class='md:hidden'/>백록담한의원의 치료 한약은<br class='md:hidden'/> 증상을 잠시 누르는 것이 아니라,<br class='md:hidden'/> 당신의 몸이 스스로 회복하는 힘을<br class='md:hidden'/> 되찾도록 돕습니다.",
            en: "Test results are normal, yet you still suffer. Why?\nThe wisdom of Oriental medicine reads the subtle imbalances that machines miss. Baekrokdam's herbal medicine doesn't just temporarily suppress symptoms, but helps your body regain its own power to heal itself.",
            ja: "検査結果は正常。でもなぜまだ辛いのでしょうか？\n東洋医学の知恵は、機械が見逃す微細な不均衡を読み取ります。白鹿潭韓医院の治療薬は、症状を一時的に抑えるのではなく、体が自ら回復する力を取り戻せるよう助けます。",
            "zh-hans":
                "检查结果正常，但为什么依然感到痛苦？\n东方医学的智慧能够解读机器无法捕捉的微细失衡。白鹿潭韩医院的韩药治疗不仅仅是暂时抑制症状，而是帮助您的身体找回自我恢复的力量。",
            vi: "Kết quả xét nghiệm bình thường. Nhưng tại sao bạn vẫn mệt mỏi? \nTrí tuệ của y học phương Đông đọc được những mất cân bằng nhỏ nhất mà máy móc bỏ qua. Thuốc Đông y của Baekrokdam không chỉ ức chế triệu chứng tạm thời, mà còn giúp cơ thể bạn lấy lại khả năng tự phục hồi.",
        },
    },
    narrative: {
        title: {
            ko: "왜 낫지 않았을까요?",
            en: "Why haven't I healed yet?",
            ja: "なぜ治らなかったのでしょうか？",
            "zh-hans": "为什么还没有治愈？",
            vi: "Tại sao tôi vẫn chưa khỏi bệnh?",
        },
        subtitle: {
            ko: "백록담은 당신의 아픔을 다르게 봅니다.",
            en: "Baekrokdam sees your pain differently.",
            ja: "白鹿潭はあなたの痛みを違う視点で見ます。",
            "zh-hans": "白鹿潭以不同的视角看待您的痛苦。",
            vi: "Baekrokdam nhìn nhận nỗi đau của bạn theo cách khác.",
        },
        step1_title: {
            ko: "아무 이상이 없다는데,<br class='md:hidden'/> 왜 나는 아플까?",
            en: "Tests show no problems, so why am I in pain?",
            ja: "異常はないと言われるのに、なぜ痛いのか？",
            "zh-hans": "检查没问题，为什么我还痛？",
            vi: "Xét nghiệm bình thường, sao tôi vẫn đau?",
        },
        step1_desc: {
            ko: "수많은 검사를 받아보셨겠죠.<br class='md:hidden'/><br class='md:hidden'/>수치는 정상이지만,<br class='md:hidden'/> 당신의 몸은 분명히<br class='md:hidden'/> 불편함을 호소하고 있습니다.",
            en: "You've likely undergone numerous tests with no clear answers. However, your body is clearly signaling a problem.",
            ja: "数多くの検査を受けたことでしょう。数値は正常でも、あなたの体は明らかに不調を訴えています。",
            "zh-hans":
                "您可能做过无数检查。虽然数据正常，但您的身体显然在发出求救信号。",
            vi: "Bạn có thể đã làm nhiều xét nghiệm. Dù chỉ số bình thường, cơ thể bạn vẫn đang lên tiếng về sự khó chịu.",
        },
        step2_title: {
            ko: "증상만 누르는 약으로는<br class='md:hidden'/> 해결되지 않습니다.",
            en: "Medication that only suppresses symptoms is not the cure.",
            ja: "症状を抑えるだけの薬は、答えではありません。",
            "zh-hans": "仅抑制症状的药物并非治本之策。",
            vi: "Thuốc chỉ ức chế triệu chứng không phải là giải pháp.",
        },
        step2_desc: {
            ko: "진통제, 항생제, 수면제...<br class='md:hidden'/><br class='md:hidden'/>잠시 편해질 뿐,<br class='md:hidden'/> 약을 끊으면 다시 제자리입니다.",
            en: "Painkillers and sedatives offer fleeting comfort, but the root cause remains. Once you stop, the pain returns.",
            ja: "鎮痛剤、抗生物質、睡眠薬… 一時的に楽になるだけで、薬をやめれば元の木阿弥です。",
            "zh-hans":
                "止痛药、抗生素、安眠药…… 只能暂时缓解，停药后痛苦依旧。",
            vi: "Thuốc giảm đau, kháng sinh... chỉ mang lại sự thoải mái nhất thời. Khi ngưng thuốc, cơn đau sẽ quay lại.",
        },
        step3_title: {
            ko: "맥을 짚고 균형을 맞추는<br class='md:hidden'/> 한약이 필요할 때.",
            en: "When you need Herbal Medicine to restore balance.",
            ja: "今こそ、脈を診てバランスを整える漢方薬が必要です。",
            "zh-hans": "现在是需要韩药调理脉搏与平衡的时候。",
            vi: "Đã đến lúc cần Thuốc Đông Y để bắt mạch và cân bằng cơ thể.",
        },
        step3_desc: {
            ko: "동양 의학은 흐름을 봅니다.<br class='md:hidden'/><br class='md:hidden'/>깊어진 불균형을 바로잡아,<br class='md:hidden'/> 몸이 스스로 회복하는 힘을<br class='md:hidden'/> 깨웁니다.",
            en: "Oriental medicine views the body as a whole. Herbal medicine reawakens your innate recovery power by correcting deep imbalances.",
            ja: "東洋医学は流れを見ます。深まった不均衡を正し、体が自ら回復する力を呼び覚まします。",
            "zh-hans":
                "东方医学注重整体气流。纠正深层失衡，唤醒身体自愈的本能。",
            vi: "Y học phương Đông nhìn vào dòng chảy. Đánh thức khả năng tự phục hồi bằng cách điều chỉnh sự mất cân bằng sâu sắc.",
        },
    },
    services: {
        title: {
            ko: "치유를 향한 여정",
            en: "Journey to Healing",
            ja: "癒しへの旅路",
            "zh-hans": "治愈之旅",
            vi: "Hành Trình Chữa Lành",
        },
        subtitle: {
            ko: "당신에게 필요한 따뜻한 처방",
            en: "Changes tailored for you",
            ja: "あなたに必要な温かい処方",
            "zh-hans": "为您量身定制的温和处方",
            vi: "Phương thuốc ấm áp dành cho bạn",
        },
        allPrograms: {
            ko: "진료과목 전체",
            en: "All Programs",
            ja: "全診療科目",
            "zh-hans": "所有诊疗项目",
            vi: "Tất Cả Chương Trình",
        },
        allProgramsDesc: {
            ko: "백록담의 모든 치유 프로그램",
            en: "Explore all our healing programs.",
            ja: "白鹿潭のすべての癒しプログラム。",
            "zh-hans": "探索白鹿潭的所有治愈项目。",
            vi: "Khám phá tất cả chương trình chữa lành của chúng tôi.",
        },
        telemedicine: {
            ko: "비대면 진료",
            en: "Telemedicine",
            ja: "オンライン診療",
            "zh-hans": "远程诊疗",
            vi: "Khám Từ Xa",
        },
        telemedicineDesc: {
            ko: "집에서 편안하게 만나는 한의원",
            en: "Convenient care from home.",
            ja: "自宅で快適に受ける診療。",
            "zh-hans": "在家享受舒适的诊疗。",
            vi: "Chăm sóc thuận tiện ngay tại nhà.",
        },
        booking: {
            ko: "진료 예약하기",
            en: "Book Appointment",
            ja: "診療予約",
            "zh-hans": "立即预约",
            vi: "Đặt Lịch Hẹn",
        },
        bookingDesc: {
            ko: "원하는 시간에 기다림 없이",
            en: "Schedule a visit without waiting.",
            ja: "待ち時間なしでスムーズに。",
            "zh-hans": "无需等待，按时就诊。",
            vi: "Đặt lịch thăm khám không cần chờ đợi.",
        },
    },
    philosophy: {
        badge: {
            ko: "흰 사슴이 노니는 치유의 연못",
            en: "Baekrokdam: Pond of the White Deer",
            ja: "白鹿潭：白い鹿が遊ぶ池",
            "zh-hans": "白鹿潭：白鹿嬉戏之池",
            vi: "Hồ Chữa Lành Nơi Hươu Trắng Dạo Chơi",
        },
        title: {
            ko: '마지막 희망으로 찾은 곳,<br/>그 간절함에 답하겠습니다.',
            en: 'A place found as a last hope,<br/>I will answer that desperation.',
            ja: '最後の希望として訪れた場所、<br/>その切実さに応えます。',
            "zh-hans": '视为最后希望而寻找至此，<br/>必将回应那份迫切。',
            vi: 'Nơi tìm đến như hy vọng cuối cùng,<br/>tôi sẽ đáp lại sự tuyệt vọng đó.',
        },
        p1: {
            ko: "진료실에서 가장 많이 듣는 말은<br class='md:hidden'/> <strong>'검사는 정상이라는데<br class='md:hidden'/> 왜 이렇게 아플까요?'</strong>였습니다.<br class='md:hidden'/><br class='md:hidden'/>수치로는 설명되지 않는<br class='md:hidden'/> 고통 속에 있는 환자분들을 보며<br class='md:hidden'/> 의사로서 깊이 고민했습니다.",
            en: "The phrase I hear most is, 'The tests are normal, so why does it hurt so much?' Watching patients in pain that numbers couldn't explain, I pondered deeply as a doctor.",
            ja: "診療室で最もよく耳にする言葉は「検査は正常だというのに、なぜこんなに痛いのですか？」でした。数値では説明できない苦痛の中にいる患者様を見て、医師として深く悩みました。",
            "zh-hans":
                "在诊疗室听到最多的话是“检查结果正常，为什么还会这么痛？” 看着身处无法用数据解释的痛苦中的患者，作为医生，我深感苦恼。",
            vi: "Câu nói tôi nghe nhiều nhất là 'Xét nghiệm bình thường, sao lại đau thế này?' Nhìn những bệnh nhân đau đớn mà con số không giải thích được, tôi đã trăn trở rất nhiều.",
        },
        p2: {
            ko: "기계가 읽어내는 데이터도 중요하지만,<br class='md:hidden'/> 그 너머에 있는<br class='md:hidden'/> <strong>몸의 흐름과 균형</strong>을 읽어내는 것이<br class='md:hidden'/> 진정한 치유의 시작임을 깨달았습니다.<br/><br/>옛 전설 속 백록담이<br class='md:hidden'/> 흰 사슴의 쉼터였듯,<br class='md:hidden'/> 저 또한 <strong>지친 몸과 마음이</strong><br class='md:hidden'/> 온전히 기댈 수 있는<br class='md:hidden'/> 치유의 공간을 만들고자 합니다.",
            en: "While data is important, true healing begins by reading the body's flow and balance beyond it.\n\nJust as the legendary Baekrokdam was a resting place for white deer, I wish to create a healing space where weary bodies and minds can fully lean.",
            ja: "機械が読み取るデータも重要ですが、その向こうにある体の流れとバランスを読み取ることが真の癒しの始まりだと悟りました。\n\n昔の伝説の中の白鹿潭が白い鹿の憩いの場であったように、私もまた、疲れた体と心が完全に頼れる癒しの空間を作りたいと思います。",
            "zh-hans":
                "虽然机器读取的数据很重要，但我领悟到，解读其背后的身体流动与平衡才是真正治愈的开始。\n\n就像古老传说中的白鹿潭是白鹿的栖息地一样，我也希望能打造一个让疲惫身心完全依靠的治愈空间。",
            vi: "Dữ liệu máy móc rất quan trọng, nhưng việc đọc được dòng chảy và sự cân bằng của cơ thể đằng sau đó mới là khởi đầu của sự chữa lành thực sự.\n\nNhư truyền thuyết Baekrokdam là nơi nghỉ ngơi của hươu trắng, tôi cũng muốn tạo ra một không gian chữa lành nơi cơ thể và tâm hồn mệt mỏi có thể hoàn toàn dựa vào.",
        },
    },
    // info skipped as it is not part of sections usually
};

const T = (category, key, locale) => {
    return tr[category][key][locale] || tr[category][key]["en"];
};

const getLocalizedPath = (path, locale) => {
    if (locale === 'ko') return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `/${locale}${cleanPath}`;
}

const supportedLocales = ['ko', 'en', 'ja', 'zh-hans', 'vi'];

let sqlOutput = '';

supportedLocales.forEach(locale => {
    const sections = [
        {
            type: "MainHero",
            images: [
                { url: "/images/hero/zen_hero_1.png", alt: "Zen Hero 1" },
                { url: "/images/hero/zen_hero_2.png", alt: "Zen Hero 2" },
                { url: "/images/hero/zen_hero_3.png", alt: "Zen Hero 3" },
            ],
            mainHeading: T("hero", "title", locale),
            subHeading: T("hero", "badge", locale),
            description: T("hero", "desc", locale),
            ctaText: T("hero", "bookAppointment", locale),
            ctaLink: getLocalizedPath("/intake", locale),
            theme: "light",
        },
        {
            type: "BridgeSection",
            title: T("bridge", "title", locale),
            description: T("bridge", "description", locale),
        },
        {
            type: "NarrativeFlow",
            title: T("narrative", "title", locale),
            subtitle: T("narrative", "subtitle", locale),
            steps: [
                {
                    number: 1,
                    title: T("narrative", "step1_title", locale),
                    description: T("narrative", "step1_desc", locale),
                },
                {
                    number: 2,
                    title: T("narrative", "step2_title", locale),
                    description: T("narrative", "step2_desc", locale),
                },
                {
                    number: 3,
                    title: T("narrative", "step3_title", locale),
                    description: T("narrative", "step3_desc", locale),
                },
            ],
        },
        {
            type: "ServiceTiles",
            title: T("services", "title", locale),
            subtitle: T("services", "subtitle", locale),
            items: [
                {
                    link: getLocalizedPath("/programs", locale),
                    icon: "🏥",
                    title: T("services", "allPrograms", locale),
                    desc: T("services", "allProgramsDesc", locale),
                    bg: "soft",
                },
                {
                    link: getLocalizedPath("/telemedicine", locale),
                    icon: "📱",
                    title: T("services", "telemedicine", locale),
                    desc: T("services", "telemedicineDesc", locale),
                    bg: "white",
                },
                {
                    link: getLocalizedPath("/intake", locale),
                    icon: "📅",
                    title: T("services", "booking", locale),
                    desc: T("services", "bookingDesc", locale),
                    bg: "soft",
                },
            ],
        },
        {
            type: "Philosophy",
            title: T("philosophy", "title", locale),
            subtitle: T("philosophy", "badge", locale),
            description: T("philosophy", "p1", locale) + "\n\n" + T("philosophy", "p2", locale),
        },
        {
            type: "HomeInfo",
        },
    ];

    const json = JSON.stringify(sections).replace(/'/g, "''"); // Escape single quotes for SQL

    // We use INSERT OR REPLACE to ensure the row exists
    // Note: We need to provide all required columns for INSERT
    sqlOutput += `
INSERT OR REPLACE INTO page_translations (page_id, locale, page_type, title, description, sections, status, created_at, updated_at)
VALUES (
    'home-page', 
    '${locale}', 
    'home',
    '${T("hero", "title", locale).replace(/<[^>]*>/g, "").replace(/\n/g, " ")}', 
    '${T("hero", "desc", locale).replace(/<[^>]*>/g, "").replace(/\n/g, " ")}', 
    '${json}', 
    'published', 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
);
`;
});

// Output to file
const outputPath = path.join(__dirname, '../migrations/0434_update_homepage_structure_final.sql');
fs.writeFileSync(outputPath, sqlOutput);

console.log(`Generated migration at: ${outputPath}`);
