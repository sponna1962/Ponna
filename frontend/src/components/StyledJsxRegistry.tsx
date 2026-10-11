'use client';

// Oct 2026 — makes the <style jsx> CSS used by the home page (and other pages)
// part of the server-sent HTML. Without this the page arrived unstyled and
// jumped into place once JavaScript ran (PageSpeed CLS 1.0). Standard Next.js
// app-router pattern for styled-jsx.
import React, { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { StyleRegistry, createStyleRegistry } from 'styled-jsx';

export default function StyledJsxRegistry({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => createStyleRegistry());
  useServerInsertedHTML(() => {
    const styles = registry.styles();
    registry.flush();
    return <>{styles}</>;
  });
  return <StyleRegistry registry={registry}>{children}</StyleRegistry>;
}
