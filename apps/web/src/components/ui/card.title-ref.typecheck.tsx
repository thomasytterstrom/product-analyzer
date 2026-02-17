import * as React from "react";

import { CardTitle } from "./card";

// NOTE:
// This file is intentionally not imported anywhere.
// It is included by `apps/web/tsconfig.json` and exists only to enforce
// compile-time contracts for our UI primitives.

const headingRef = React.createRef<HTMLHeadingElement>();

// CardTitle renders an <h3>, so it must accept an HTMLHeadingElement ref.
<CardTitle ref={headingRef}>Hello</CardTitle>;
