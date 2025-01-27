/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import extensionLoaderInjectable from "./extension-loader/extension-loader.injectable";

const extensionsInjectable = getInjectable({
  id: "extensions",

  instantiate: (di) => {
    const extensionLoader = di.inject(extensionLoaderInjectable);

    return computed(() => extensionLoader.enabledExtensionInstances);
  },
});

export default extensionsInjectable;
