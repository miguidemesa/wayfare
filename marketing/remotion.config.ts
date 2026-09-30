// All configuration options: https://remotion.dev/docs/config
// Note: the Node.JS render APIs ignore this file; pass options directly there.

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The globe, 3D logo and map plates are WebGL.
Config.setChromiumOpenGlRenderer("angle");
