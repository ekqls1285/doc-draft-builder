import os
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai

# .env 파일에 적어둔 환경변수(GEMINI_API_KEY)를 불러옵니다.
load_dotenv()

app = Flask(__name__)

MODEL_NAME = "gemini-3.5-flash-lite"


def build_prompt(data: dict) -> str:
    """사용자 입력값을 바탕으로 Gemini에게 보낼 요청문(프롬프트)을 만듭니다."""
    doc_type = data["doc_type"]
    title = data["title"]
    when = data.get("when", "").strip()
    where = data.get("where", "").strip()
    who = data.get("who", "").strip()
    how = data.get("how", "").strip()
    contact = data.get("contact", "").strip()
    recipient = data.get("recipient", "").strip()
    tone = data.get("tone", "공식적").strip() or "공식적"
    prompt_type = data.get("prompt_type", "A").strip().upper()

    facts_lines = [
        f"- 문서 종류: {doc_type}",
        f"- 제목: {title}",
        f"- 일시: {when if when else '(입력 없음)'}",
        f"- 장소: {where if where else '(입력 없음)'}",
        f"- 대상: {who if who else '(입력 없음)'}",
        f"- 신청 방법: {how if how else '(입력 없음)'}",
        f"- 문의처: {contact if contact else '(입력 없음)'}",
        f"- 받는 사람: {recipient if recipient else '(입력 없음)'}",
        f"- 어조: {tone}",
    ]
    facts_text = "\n".join(facts_lines)

    if prompt_type == "B":
        return (
            "당신은 대학 행정 실무에 능숙한 문서 작성 도우미입니다.\n"
            "아래 입력 정보를 바탕으로 업무 문서 초안을 마크다운(Markdown) 형식으로 작성해 주세요.\n\n"
            "[대학 행정 문서 체크리스트]\n"
            "1. 6하원칙(누가, 언제, 어디서, 무엇을, 어떻게, 왜)이 빠짐없이 드러나도록 점검하여 구성하세요.\n"
            "2. 정중한 공식 문체를 기본으로 하되, 선택된 어조(공식적/친근한)를 자연스럽게 반영하세요.\n"
            "3. 문서 하단에 문의처가 명확히 포함되도록 작성하세요.\n"
            "4. 중요 규칙: 입력에 없는 내용은 절대 지어내지 말고 반드시 [확인 필요]로 표시하세요.\n\n"
            "[입력 정보]\n"
            f"{facts_text}\n"
        )

    return (
        "아래 입력 정보를 바탕으로 해당 종류의 업무 문서 초안을 마크다운(Markdown) 형식으로 작성해 주세요.\n\n"
        "[입력 정보]\n"
        f"{facts_text}\n"
    )


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or {}

    doc_type = (data.get("doc_type") or "").strip()
    title = (data.get("title") or "").strip()

    # 서버에서도 필수 입력값(문서 종류, 제목)을 다시 한 번 검증합니다.
    if not doc_type or not title:
        return jsonify({"error": "문서 종류와 제목은 반드시 입력해 주세요."}), 400

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        app.logger.error("GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.")
        return (
            jsonify(
                {
                    "error": "Gemini API 키가 설정되지 않았습니다. .env 파일을 확인해 주세요."
                }
            ),
            500,
        )

    prompt = build_prompt(
        {
            "doc_type": doc_type,
            "title": title,
            "when": data.get("when", ""),
            "where": data.get("where", ""),
            "who": data.get("who", ""),
            "how": data.get("how", ""),
            "contact": data.get("contact", ""),
            "recipient": data.get("recipient", ""),
            "tone": data.get("tone", "공식적"),
            "prompt_type": data.get("prompt_type", "A"),
        }
    )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )
        draft_text = (response.text or "").strip()
        if not draft_text:
            return (
                jsonify(
                    {
                        "error": "AI가 빈 응답을 돌려주었습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요."
                    }
                ),
                500,
            )
        return jsonify({"draft": draft_text})
    except Exception:
        app.logger.exception("문서 초안 생성 중 오류가 발생했습니다.")
        return (
            jsonify(
                {
                    "error": "문서 초안을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
                }
            ),
            500,
        )


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
