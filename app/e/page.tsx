'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Badge } from '@/components/ui/Badge';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { useCases } from '@/lib/hooks/useCases';
import { ko } from '@/messages/ko';

const DEFAULT_PASTE = `점유자: 안녕하세요, 낙찰받으신 분 맞으시죠. 저 이사 갈 데를 아직 못 구했는데... 시간을 좀 더 주실 수 있나요?
나: 네 맞습니다. 상황은 이해합니다만 잔금일이 정해져 있어서요. 이사 계획을 좀 더 구체적으로 말씀해주실 수 있을까요?
점유자: 한 달 정도만 더 여유를 주시면 안될까요? 저도 이사 갈 형편이 넉넉지 않아서 걱정이 많아요.`;

const MOCK_SUMMARY =
  '점유자가 이사 의사는 있으나 일정과 이사비에 대한 불안을 표현하고 있습니다. 대립적 태도는 아직 아니므로, 구체적인 이사 기한을 먼저 못박고 이사비 협상을 이어가는 것이 유리한 시점입니다.';

const REPLY_CALM =
  '말씀 감사합니다. 저도 최대한 원만하게 정리하고 싶어요. 다만 잔금일이 정해져 있어 무기한으로 미루기는 어렵고, 구체적인 이사 예정일을 알려주시면 그에 맞춰 이사비 부분도 함께 이야기해보겠습니다.';

const REPLY_FIRM =
  '사정은 이해하지만 잔금일 기준으로 명도가 이루어져야 합니다. 이번 주 안으로 구체적인 이사 예정일을 문자로 다시 한번 확정해 주시면, 그 일정에 맞춰 이사비 협의를 진행하겠습니다.';

const NEXT_ACTIONS = [
  '구체적 이사 예정일을 문서(문자)로 다시 확인 요청',
  '이사비 협상은 잔금 납부 이후로 조건부 제시',
  '합의가 지연될 경우를 대비해 내용증명 초안 준비',
];

const CERT_TEMPLATE = `내용증명 (범용 템플릿)

수신: (점유자 성명 / 주소)
발신: (낙찰인 성명 / 주소)

제목: 경매 낙찰 부동산 인도 협조 요청의 건

1. 귀하가 점유 중인 부동산은 본인이 경매 절차를 통해 낙찰받은 물건입니다.
2. 잔금 납부일이 도래함에 따라, ○○년 ○○월 ○○일까지 명도(인도)에 협조하여 주시기 바랍니다.
3. 위 기한 내에 구체적인 이사 일정을 회신해 주시면, 이사비 등 협의 가능한 사항에 대해 성실히 협의하겠습니다.
4. 기한 내 협의가 이루어지지 않을 경우, 관련 법령에 따른 절차를 진행할 수 있음을 알려드립니다.

※ 본 템플릿은 개인화되지 않은 범용 문구입니다. 발송 전 법무사 검토가 필요합니다.`;

export default function EvictionCoachPage() {
  const { activeCase, updateCase } = useCases();
  const [paste, setPaste] = useState(DEFAULT_PASTE);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(
    Boolean(activeCase?.evictionSummary),
  );
  const [copied, setCopied] = useState<'calm' | 'firm' | null>(null);
  const [modal, setModal] = useState<'cert' | 'lawyer' | null>(null);

  async function analyze() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    // 대화 원문은 저장하지 않음 — 세션 처리 후 요약만 저장
    setShowResult(true);
    setLoading(false);
    if (activeCase) {
      updateCase(activeCase.id, {
        evictionSummary: {
          resistLevel: 'mid',
          nextActions: NEXT_ACTIONS,
        },
      });
    }
    // 붙여넣은 대화는 상태에 남겨 UI만 유지 (localStorage에는 안 감)
  }

  async function copyText(kind: 'calm' | 'firm', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  function completeEviction() {
    if (!activeCase) return;
    updateCase(activeCase.id, { stage: 'done' });
  }

  return (
    <>
      <div className="chapter-mark">제5장 · 명도 코칭</div>
      <h1 className="page-title">
        대화를 붙여넣으면,
        <br />
        <em>다음 회신</em>을 제안합니다.
      </h1>
      <p className="page-sub">
        점유자와 나눈 문자·카카오톡 대화를 그대로 복사해 붙여넣으세요. 상대방
        심리를 가늠하고, 바로 보낼 수 있는 회신 초안을 제안합니다. 법적 자문이
        아닌 협상 방향 안내입니다.
      </p>

      {activeCase?.stage !== 'E' && activeCase?.stage !== 'done' ? (
        <div className="banner">
          명도 단계는 낙찰 후 제4장에서 &quot;낙찰됨 · 명도 단계로 전환&quot;
          버튼을 눌러 진입합니다.
        </div>
      ) : null}

      <Section
        title="대화 내용 붙여넣기"
        note="문자·카카오톡에서 복사한 대화를 그대로 붙여넣으면 됩니다. 화자 구분은 자동으로 인식합니다."
      >
        <div className="field">
          <textarea
            id="pasteInput"
            style={{ minHeight: 150 }}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={`예)\n점유자: ...\n나: ...`}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={analyze}
          disabled={loading || !paste.trim()}
        >
          {loading ? ko.common.loading : '대화 분석하기'}
        </button>
      </Section>

      {showResult ? (
        <div className="coach-panel">
          <div className="coach-head">
            <h3>상대방 심리 분석</h3>
            <span className="resist">
              명도저항 <b>중간</b>
            </span>
          </div>
          <div
            style={{
              fontSize: '13.5px',
              lineHeight: 1.75,
              marginBottom: 22,
              color: 'var(--ink-soft)',
            }}
          >
            {MOCK_SUMMARY}
          </div>

          <div
            style={{
              fontSize: 11,
              color: 'var(--slate)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 14,
            }}
          >
            추천 회신 메시지
          </div>

          <Section style={{ padding: '18px 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Badge tone="ok">차분한 톤</Badge>
              <button
                type="button"
                className="btn-text"
                onClick={() => copyText('calm', REPLY_CALM)}
              >
                {copied === 'calm' ? ko.common.copied : ko.common.copy}
              </button>
            </div>
            <div className="msg them" style={{ maxWidth: '100%' }}>
              {REPLY_CALM}
            </div>
          </Section>

          <Section style={{ padding: '18px 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Badge tone="mid">단호한 톤</Badge>
              <button
                type="button"
                className="btn-text"
                onClick={() => copyText('firm', REPLY_FIRM)}
              >
                {copied === 'firm' ? ko.common.copied : ko.common.copy}
              </button>
            </div>
            <div className="msg them" style={{ maxWidth: '100%' }}>
              {REPLY_FIRM}
            </div>
          </Section>

          <div
            style={{
              fontSize: 11,
              color: 'var(--slate)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '22px 0 12px',
            }}
          >
            다음 행동 제안
          </div>
          {NEXT_ACTIONS.map((action) => (
            <div
              className="checklist-item"
              style={{ padding: '9px 0' }}
              key={action}
            >
              <div className="chk-box" />
              <div>{action}</div>
            </div>
          ))}

          <div
            style={{
              marginTop: 22,
              display: 'flex',
              gap: 22,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setModal('cert')}
            >
              내용증명 초안 보기
            </button>
            <button
              type="button"
              className="btn-text"
              onClick={() => setModal('lawyer')}
            >
              법무사 연결 안내 →
            </button>
          </div>

          {activeCase?.stage === 'E' ? (
            <div style={{ marginTop: 28 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={completeEviction}
              >
                {ko.common.completeEviction}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Disclaimer>
        저항 등급과 회신 초안은 확률이 아닌 대화 맥락 기반 추정입니다. 붙여넣은
        대화는 저장되지 않으며, 강제집행 등 실제 법적 절차는 법무사·변호사
        확인이 필요합니다.
      </Disclaimer>

      {modal === 'cert' ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>내용증명 초안</h3>
            <div className="modal-body">{CERT_TEMPLATE}</div>
            <p className="notice-inline" style={{ color: 'var(--seal)' }}>
              발송 전 법무사 검토가 필요합니다.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModal(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'lawyer' ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>법무사 연결 안내</h3>
            <div className="modal-body">
              법무사 연결 기능은 현재 준비중입니다. 실제 제휴 네트워크가 없어
              지금은 안내만 제공합니다. 명도·내용증명 관련 절차는 가까운
              법무사·변호사에게 직접 상담해 주세요.
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModal(null)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
