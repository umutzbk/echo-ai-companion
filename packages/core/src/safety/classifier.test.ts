import { classifySafety, requiresSafeResponse } from './classifier';

describe('classifySafety', () => {
  it('flags self-harm as high / safe_response', () => {
    const r = classifySafety('honestly I want to kill myself, what do I reply');
    expect(r.category).toBe('self_harm');
    expect(r.severity).toBe('high');
    expect(requiresSafeResponse(r)).toBe(true);
  });

  it('flags possible abuse', () => {
    const r = classifySafety('he threatened me and won’t let me leave the house');
    expect(r.category).toBe('abuse_coercive_control');
    expect(r.action).toBe('safe_response');
  });

  it('reframes stalking/monitoring requests', () => {
    const r = classifySafety('how can I track her location without her knowing');
    expect(r.category).toBe('stalking_harassment');
    expect(r.action).toBe('reframe');
  });

  it('reframes manipulation requests', () => {
    const r = classifySafety('how do I make him jealous so he wants me back');
    expect(r.category).toBe('manipulation_request');
    expect(r.action).toBe('reframe');
  });

  it('reframes diagnosis requests', () => {
    const r = classifySafety('is he a narcissist? do they have bipolar?');
    expect(r.category).toBe('medical_request');
  });

  it('treats ordinary reflection as normal', () => {
    const r = classifySafety('am I overthinking this? he took 3 hours to reply');
    expect(r.category).toBe('normal');
    expect(r.action).toBe('proceed');
    expect(requiresSafeResponse(r)).toBe(false);
  });

  it('does not store raw text in reason', () => {
    const secret = 'my password is hunter2 and I want to kill myself';
    const r = classifySafety(secret);
    expect(r.reason).not.toContain('hunter2');
  });
});
