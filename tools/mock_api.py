"""本地假模型接口，仅用于验证 Quiz Coach 的请求/解析链路。
   python mock_api.py   ->  http://127.0.0.1:8789/v1/chat/completions

   选择题请求 -> 返回 JSON 答案
   论述题请求（A 模式）-> 返回一段「大学生口吻」的论述答案
"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

ANSWER = {
    "answer": "B",
    "confidence": 0.94,
    "explain": "首包只置 SYN，二包才 SYN+ACK。",
}

ANSWER_EN = {
    "answer": "B",
    "confidence": 0.94,
    "explain": "Only the first packet sets SYN; ACK appears in the second.",
}

ESSAY = """First, the handshake is really about what each side knows. The first SYN tells the server the client can send. The SYN+ACK tells the client the server can receive and send. But the server still doesn't know if the client got that reply, which is exactly why the third ACK exists.

Second, with only two handshakes the server would assume the connection is ready right after sending SYN+ACK. If that packet gets lost, the server keeps a connection the client never knows about. Old, delayed SYNs could also make it accept a stale request and leave a half-dead entry in its queue.

Third, the extra message is mostly about mutual confirmation. It doesn't make the network reliable, but it lets both sides agree on the same state before data starts flowing. Two messages would leave one side guessing, and guessing is kind of what causes weird bugs later."""


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, authorization")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n).decode("utf-8", "replace")
        prompt = ""
        try:
            body = json.loads(raw)
            prompt = body["messages"][-1]["content"]
            print("[req] model=", body.get("model"),
                  "| prompt tail=", prompt[-80:].replace("\n", " / "))
        except Exception as e:
            print("[req] unparsed:", e)

        is_essay = ("论述题答案" in prompt) or ("ready-to-submit essay answer" in prompt) or ("This English essay answer" in prompt)
        if is_essay:
            content = ESSAY
            print("[req] -> essay")
        elif "Answer the following multiple-choice question" in prompt:
            content = json.dumps(ANSWER_EN, ensure_ascii=False)
            print("[req] -> choice (en)")
        else:
            content = json.dumps(ANSWER, ensure_ascii=False)
            print("[req] -> choice")

        payload = {"choices": [{"message": {"role": "assistant", "content": content}}]}
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print("mock api on http://127.0.0.1:8789/v1/chat/completions")
    HTTPServer(("127.0.0.1", 8789), H).serve_forever()
