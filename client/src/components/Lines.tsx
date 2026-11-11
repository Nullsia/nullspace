import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from "react";

/*
 * Puts each sentence of a paragraph on its own line.
 * Strings are split after ". ", "? " or "! " and joined with <br/>; fragments and inline
 * elements (em, span, strong) are walked so mixed JSX copy is handled the same way.
 * A sentence longer than the line wraps at word boundaries (word-break: keep-all in CSS).
 */
const SPLIT = /(?<=[.?!])\s+(?=[^\s.·—-])/;

function split(text: string, key: string): ReactNode {
  const parts = text.split(SPLIT);
  if (parts.length < 2) return text;
  return parts.map((part, i) => <Fragment key={`${key}-${i}`}>{i > 0 && <br />}{part}</Fragment>);
}

function walk(node: ReactNode, key = "l"): ReactNode {
  if (typeof node === "string") return split(node, key);
  if (Array.isArray(node)) return node.map((n, i) => <Fragment key={`${key}-${i}`}>{walk(n, `${key}-${i}`)}</Fragment>);
  if (isValidElement<{ children?: ReactNode }>(node)) {
    const inline = node.type === Fragment || node.type === "em" || node.type === "span" || node.type === "strong";
    if (!inline || node.props.children == null) return node;
    return cloneElement(node, undefined, walk(Children.toArray(node.props.children), key));
  }
  return node;
}

export function Lines({ children }: { children?: ReactNode }) {
  return <>{walk(children)}</>;
}

export default Lines;
