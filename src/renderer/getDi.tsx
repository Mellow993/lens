/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { createContainer } from "@ogre-tools/injectable";
import { setLegacyGlobalDiForExtensionApi } from "../extensions/di-legacy-globals/legacy-global-di-for-extension-api";

export const getDi = () => {
  const di = createContainer(
    getRequireContextForRendererCode,
    getRequireContextForCommonExtensionCode,
    getRequireContextForCommonCode,
  );

  setLegacyGlobalDiForExtensionApi(di);

  return di;
};

const getRequireContextForRendererCode = () =>
  require.context("./", true, /\.injectable\.(ts|tsx)$/);

const getRequireContextForCommonCode = () =>
  require.context("../common", true, /\.injectable\.(ts|tsx)$/);

const getRequireContextForCommonExtensionCode = () =>
  require.context("../extensions", true, /\.injectable\.(ts|tsx)$/);
