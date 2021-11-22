/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { EditResourceTabStore } from "./store";
import createStorageInjectable from "../../../utils/create-storage/create-storage.injectable";
import { apiKube } from "../../../api";

const editResourceTabStoreInjectable = getInjectable({
  instantiate: (di) => new EditResourceTabStore({
    createStorage: di.inject(createStorageInjectable),
    apiKube, // TODO: make injectable
  }),

  lifecycle: lifecycleEnum.singleton,
});

export default editResourceTabStoreInjectable;
