#!/usr/bin/env bun

process.title = "sandpiper";

import { main } from "@mariozechner/pi-coding-agent";

process.env.PI_SKIP_VERSION_CHECK = "1";
main(process.argv.slice(2));
