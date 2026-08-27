"""위험한 셸 명령을 실행 전에 차단한다.

퍼미션의 deny 규칙은 명령어 앞부분만 본다. 그래서
`cd /tmp && rm -rf x` 처럼 중간에 숨거나
`curl ... | sh` 처럼 파이프로 넘기는 형태는 규칙으로 잡히지 않는다.
이 후크는 명령 전체를 훑어 그런 형태까지 막는다.

Claude Code가 Bash를 실행하기 직전(PreToolUse)에 호출하며,
표준입력으로 명령이 담긴 JSON을 받는다. 종료 코드 2가 차단이다.
"""

import json
import re
import sys

# (정규식, 사람이 읽을 이름)
PATTERNS = [
    (r'(^|[;&|]\s*)sudo\b', 'sudo'),
    # 재귀 삭제는 -f가 붙었는지와 무관하게 막는다.
    # -rf만 막고 -r을 열어두면 폴더를 통째로 지우는 길이 그대로 남는다.
    (
        r'(^|[;&|]\s*)rm\s+(-\S*[rR]|--recursive)',
        'rm -r (폴더 재귀 삭제)',
    ),
    # 우회로도 함께 막는다. 한쪽만 막으면 다른 쪽으로 같은 일이 벌어진다.
    (
        r'(^|[;&|]\s*)find\b[^;&|]*(-delete\b|-exec\s+rm\b|-execdir\s+rm\b)',
        'find로 대량 삭제',
    ),
    (
        r'(?i)(^|[;&|]\s*)(remove-item|ri|rd|rmdir)\b[^;&|]*-recurse\b',
        'Remove-Item -Recurse (PowerShell 재귀 삭제)',
    ),
    (
        r'(?i)(^|[;&|]\s*)(rmdir|del|rd)\s+[^;&|]*/[sS]\b',
        'rmdir /s · del /s (Windows 재귀 삭제)',
    ),
    (r'\bchmod\s+(-\S+\s+)*(777|a\+rwx|ugo\+rwx)\b', 'chmod 777 (모두에게 전체 권한)'),
    (
        r'\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?\S*(bash|sh|zsh|ksh|python\d?|perl|node)\b',
        '내려받은 스크립트를 검사 없이 바로 실행',
    ),
    # 옵션이 뒤에 붙는 형태(git push origin main --force)까지 잡으려면
    # 앞부분만 보는 deny 규칙으로는 부족해 여기서 한 번 더 본다.
    (
        r'(^|[;&|]\s*)git\s+push\b[^;&|]*\s(--force\b|--force-with-lease\b|-f\b)',
        'git push --force (원격 기록을 덮어씀)',
    ),
    (
        r'(^|[;&|]\s*)git\s+reset\b[^;&|]*\s--hard\b',
        'git reset --hard (커밋 안 한 작업을 버림)',
    ),
]


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        # 입력을 못 읽으면 통과시킨다. 후크 오류가 정상 작업을 막으면 안 된다.
        return 0

    command = payload.get('tool_input', {}).get('command', '')

    for pattern, label in PATTERNS:
        if re.search(pattern, command):
            print(f'차단됨: {label}', file=sys.stderr)
            print(f'명령: {command}', file=sys.stderr)
            print('꼭 필요하면 사용자가 터미널에서 직접 실행해야 합니다.', file=sys.stderr)
            return 2

    return 0


if __name__ == '__main__':
    sys.exit(main())
