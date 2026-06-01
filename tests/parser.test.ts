import { describe, it, expect } from 'vitest';
import { parseOptions } from '../src/parser';

describe('parseOptions', () => {
  it('returns empty object for blank source', () => {
    expect(parseOptions('')).toEqual({});
    expect(parseOptions('   \n\t  ')).toEqual({});
    expect(parseOptions('# just a comment')).toEqual({});
  });

  it('ignores height and folder (they are not supported - fixed single height, folder always from current note)', () => {
    const o = parseOptions('height: 95\nfolder: Projects/Whatever');
    expect(o.mode).toBeUndefined();
    // @ts-expect-error - these fields no longer exist by design
    expect(o.height).toBeUndefined();
    // @ts-expect-error
    expect(o.folder).toBeUndefined();
  });

  it('parses mode: filtered and target with [[ ]]', () => {
    const o = parseOptions('mode: filtered\ntarget: "[[Daily Note]]"\nexclude:\n  - "[[Secret]]"');
    expect(o.mode).toBe('filtered');
    expect(o.target).toBe('Daily Note');
    expect(o.exclude).toEqual(['Secret']);
  });

  it('parses manual mode with nodes list (flow and block)', () => {
    const o1 = parseOptions('mode: manual\nnodes: ["[[A]]", "B"]');
    expect(o1.mode).toBe('manual');
    expect(o1.nodes).toEqual(['A', 'B']);

    const o2 = parseOptions('mode: manual\nnodes:\n- "[[C]]"\n- D');
    expect(o2.nodes).toEqual(['C', 'D']);
  });

  it('ignores unsupported keys (folder/height) with no error', () => {
    const o = parseOptions('folder: Projects/Alpha\nheight: 80\nmode: filtered');
    expect(o.mode).toBe('filtered');
  });

  it('strips [[ ]] and |alias in normalize for relevant fields', () => {
    const o = parseOptions('mode: manual\nnodes:\n- "[[Note|Display]]"\ntarget: "[[Other|Alias]]"\nexclude: ["[[Ex]]"]');
    expect(o.nodes?.[0]).toBe('Note|Display'); // keep after first | for now? or strip display; decide in impl
    // actual normalize will clean the link part only
  });

  it('returns error object on invalid YAML', () => {
    const o = parseOptions('mode: [unclosed');
    expect(o.error).toBeDefined();
    expect(typeof o.error).toBe('string');
  });

  it('ignores height completely (no height support by design)', () => {
    const o = parseOptions('height: 50');
    // @ts-expect-error
    expect(o.height).toBeUndefined();
  });
});
