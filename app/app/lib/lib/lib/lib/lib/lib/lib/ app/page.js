'use client';

import { useMemo, useState } from 'react';
import { auditEstimate, buildSupplementLetter } from '../lib/audit.js';
import { extractPdfText } from '../lib/pdf-browser.js';
import { SAMPLE_TEXT } from '../lib/sample.js';

const MAX_MB = 25;
const fmtQty = (q) => `${q.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${q.unit}`;

function Finding({ f, confirmed, onToggle }) {
  const verify = f.severity === 'verify';
  return (
    <li className={`find ${verify ? 'verify' : 'likely'}`}>
      <h3>{f.title}</h3>
      <p className="add">
        {f.request}
        {f.qty && <span className="qty">{fmtQty(f.qty)}</span>}
      </p>
      <p className="why">{f.why}</p>
      {f.codeRef && <p className="ref">Code: {f.codeRef}</p>}
      {verify && (
        <label className="check">
          <input type="checkbox" checked={confirmed} onChange={() => onToggle(f.id)} />
          <span>I confirmed this on site. Add it to the letter.</span>
        </label>
      )}
    </li>
  );
}

export default function Page() {
  const [status, setStatus] = useState('idle'); // idle | reading | done | error
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState('');
  const [me, setMe] = useState({ contractor: '', contact: '', adjuster: '' });
  const [confirmed, setConfirmed] = useState([]);
  const [copied, setCopied] = useState('');

  const audit = useMemo(() => (text ? auditEstimate(text) : null), [text]);
  const letter = useMemo(
    () =>
      audit
        ? buildSupplementLetter(audit, {
            contractor: me.contractor || undefined,
            contact: me.contact || undefined,
            adjuster: me.adjuster || undefined,
            includeVerify: confirmed,
          })
        : '',
    [audit, me, confirmed],
  );

  function show(nextText, name) {
    setText(nextText);
    setFileName(name);
    setConfirmed([]);
    setCopied('');
    setError('');
    setStatus('done');
  }

  function fail(message) {
    setText('');
    setStatus('error');
    setError(message);
  }

  async function handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      return fail('That is not a PDF. Choose the estimate PDF from the insurer.');
    }
    if (file.size > MAX_MB * 1024 * 1024) return fail(`That file is over ${MAX_MB} MB.`);
    setStatus('reading');
    setFileName(file.name);
    setText('');
    try {
      const t = await extractPdfText(file);
      if (!t.trim()) return fail('No text found in that PDF. It is probably a scan. Paste the text below or send a text-based PDF.');
      show(t, file.name);
    } catch (e) {
      console.error(e);
      fail('Could not read that PDF. If it is password protected, remove the password first.');
    }
  }

  function toggle(id) {
    setConfirmed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied('Copied');
    } catch {
      setCopied('Copy failed. Press and hold the letter to select it.');
    }
    setTimeout(() => setCopied(''), 2500);
  }

  const likely = audit ? audit.findings.filter((f) => f.severity === 'likely') : [];
  const verify = audit ? audit.findings.filter((f) => f.severity === 'verify') : [];
  const h = audit?.header ?? {};

  return (
    <main className="wrap">
      <p className="brand">RoofCheck</p>

      <section className="hero">
        <h1>Find what the carrier left off your roof estimate.</h1>
        <p className="lede">
          Drop in the adjuster&apos;s estimate PDF. You get the line items that look missing and a supplement letter you can
          send. The file is read on your device and is never uploaded.
        </p>

        <label
          className={`drop${dragging ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }}
          />
          <span className="drop-title">Choose the estimate PDF</span>
          <span className="drop-sub">or drop it here</span>
        </label>

        <button className="link" type="button" onClick={() => show(SAMPLE_TEXT, 'sample estimate')}>
          Try a sample estimate
        </button>

        {status === 'reading' && <p className="status" role="status">Reading {fileName}...</p>}
        {status === 'error' && <p className="error" role="alert">{error}</p>}
      </section>

      {audit && (
        <section className="results" aria-live="polite">
          <hr className="chalk" />
          <p className="count">
            <span className="num">{likely.length}</span> likely missing
          </p>
          <p className="sub">
            {verify.length} more to confirm on site. {audit.itemCount} line items read from {fileName}.
            {(h.claim || h.insured) && <> Claim {h.claim ?? 'unknown'}{h.insured ? `, ${h.insured}` : ''}.</>}
          </p>

          {audit.warnings.length > 0 && (
            <ul className="warnings">
              {audit.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}

          {audit.findings.length === 0 && audit.itemCount > 0 && (
            <p className="none">No common gaps found. That does not mean the estimate is complete. Walk the roof.</p>
          )}

          {likely.length > 0 && (
            <>
              <h2>What to add</h2>
              <ol className="finds">
                {likely.map((f) => <Finding key={f.id} f={f} />)}
              </ol>
            </>
          )}

          {verify.length > 0 && (
            <>
              <h2>Confirm on site first</h2>
              <ol className="finds">
                {verify.map((f) => <Finding key={f.id} f={f} confirmed={confirmed.includes(f.id)} onToggle={toggle} />)}
              </ol>
            </>
          )}

          {audit.itemCount > 0 && (
            <>
              <hr className="chalk" />
              <h2>Supplement letter</h2>
              <div className="fields">
                <label>Your company<input type="text" value={me.contractor} onChange={(e) => setMe({ ...me, contractor: e.target.value })} autoComplete="organization" /></label>
                <label>Phone or email<input type="text" value={me.contact} onChange={(e) => setMe({ ...me, contact: e.target.value })} /></label>
                <label>Adjuster name<input type="text" value={me.adjuster} onChange={(e) => setMe({ ...me, adjuster: e.target.value })} /></label>
              </div>
              <pre className="letter">{letter}</pre>
              <button className="btn" type="button" onClick={copy}>Copy letter</button>
              {copied && <span className="copied" role="status">{copied}</span>}
            </>
          )}
        </section>
      )}

      <details className="paste">
        <summary>Paste estimate text instead</summary>
        <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={8} placeholder="Paste the text of the estimate here" />
        <button className="btn" type="button" onClick={() => pasted.trim() && show(pasted, 'pasted text')}>Check pasted text</button>
      </details>

      <p className="fine">
        These checks are prompts to review, not legal advice. Building codes, policy terms and contractor rules differ by
        city, county and state. Confirm every item and every code reference before you send anything.
      </p>
    </main>
  );
}
