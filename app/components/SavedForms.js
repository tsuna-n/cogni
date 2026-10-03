"use client";

import { useEffect, useState } from 'react';
import { questions, answerOptions, respondentOptions } from '@/lib/assessment.mjs';

export default function SavedForms({ locale = 'th', forms: suppliedForms, enabled = false }) {
  const [loaded, setLoaded] = useState({});
  const [error, setError] = useState(false);
  const t = (th, en) => locale === 'th' ? th : en;
  useEffect(() => {
    if (!enabled || suppliedForms) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/forms', { cache: 'no-store' });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (active) { setLoaded(data.forms); setError(false); }
      } catch { if (active) setError(true); }
    };
    load();
    window.addEventListener('screening-saved', load);
    return () => { active = false; window.removeEventListener('screening-saved', load); };
  }, [enabled, suppliedForms]);
  const forms = suppliedForms || loaded;
  const screenings = Object.values(forms.screeningHistory || {}).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const setup = forms.setup;
  return <div className="card" style={{ marginTop: 14 }} data-no-translate>
    <h3>{t('ข้อมูลแบบฟอร์มที่บันทึก', 'Saved form data')}</h3>
    {error && <p role="alert">{t('โหลดข้อมูลไม่สำเร็จ กรุณาเปิดหน้านี้อีกครั้ง', 'Could not load saved forms. Reopen this page to retry.')}</p>}
    {setup && <details><summary>{t('ตั้งค่าการทดลอง', 'Study setup')} · {setup.participant} · {setup.sessionId}</summary>
      <dl>
        <dt>{t('กลุ่มวิจัย', 'Study group')}</dt><dd>{setup.studyGroup === 'patient' ? t('ผู้ป่วย', 'Patient') : setup.studyGroup === 'control' ? t('กลุ่มควบคุม', 'Control') : '—'}</dd>
        <dt>{t('เงื่อนไขการทดลอง', 'Condition')}</dt><dd>{setup.condition || '—'}</dd>
        <dt>{t('ระยะเวลา พักนิ่ง / ทำภารกิจ / พักหลังงาน (วินาที)', 'Baseline / task / rest (seconds)')}</dt><dd>{setup.baselineSeconds} / {setup.taskSeconds} / {setup.postTaskSeconds}</dd>
        <dt>{t('ได้รับความยินยอม', 'Consent confirmed')}</dt><dd>{setup.consent ? t('ยืนยันแล้ว', 'Confirmed') : t('ยังไม่ยืนยัน', 'Not confirmed')}</dd>
      </dl>
    </details>}
    <h4>{t('ประวัติแบบคัดกรองเบื้องต้น', 'Preliminary screening history')}</h4>
    {!screenings.length && <p className="muted">{t('ยังไม่มีคำตอบที่ยืนยันแล้ว', 'No confirmed answers yet.')}</p>}
    {screenings.map((screening) => {
      const respondent = respondentOptions.find((option) => option.value === screening.respondent);
      return <details key={screening.id}>
        <summary>{new Date(screening.submittedAt).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US')} · {screening.participantId}</summary>
        <p>{t('ผู้ตอบแบบประเมิน', 'Respondent')}: {respondent ? t(respondent.th, respondent.en) : '—'}</p>
        <ol>{questions.map((question, index) => {
          const answer = answerOptions.find((option) => option.value === screening.answers[index]);
          return <li key={question.id}>{t(question.text, question.en)}<p><strong>{answer ? t(answer.th, answer.en) : '—'}</strong></p></li>;
        })}</ol>
      </details>;
    })}
  </div>;
}
