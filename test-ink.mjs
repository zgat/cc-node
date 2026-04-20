import React from 'react';
import { createRoot } from './dist/ink.js';

const root = await createRoot();
root.render(React.createElement('Text', null, 'Hello from Ink'));
console.error('DEBUG: rendered');
await new Promise(r => setTimeout(r, 500));
root.unmount();
console.error('DEBUG: unmounted');
