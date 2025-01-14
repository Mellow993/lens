/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import glob from "glob";
import { memoize, kebabCase } from "lodash/fp";
import { createContainer } from "@ogre-tools/injectable";

import { setLegacyGlobalDiForExtensionApi } from "../extensions/as-legacy-globals-for-extension-api/legacy-global-di-for-extension-api";
import getElectronAppPathInjectable from "./app-paths/get-electron-app-path/get-electron-app-path.injectable";
import setElectronAppPathInjectable from "./app-paths/set-electron-app-path/set-electron-app-path.injectable";
import appNameInjectable from "./app-paths/app-name/app-name.injectable";
import registerChannelInjectable from "./app-paths/register-channel/register-channel.injectable";
import writeJsonFileInjectable from "../common/fs/write-json-file.injectable";
import readJsonFileInjectable from "../common/fs/read-json-file.injectable";
import readFileInjectable from "../common/fs/read-file.injectable";
import directoryForBundledBinariesInjectable from "../common/app-paths/directory-for-bundled-binaries/directory-for-bundled-binaries.injectable";
import spawnInjectable from "./child-process/spawn.injectable";

export const getDiForUnitTesting = (
  { doGeneralOverrides } = { doGeneralOverrides: false },
) => {
  const di = createContainer();

  setLegacyGlobalDiForExtensionApi(di);

  for (const filePath of getInjectableFilePaths()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const injectableInstance = require(filePath).default;

    di.register({
      ...injectableInstance,
      aliases: [injectableInstance, ...(injectableInstance.aliases || [])],
    });
  }

  di.preventSideEffects();

  if (doGeneralOverrides) {
    di.override(
      getElectronAppPathInjectable,
      () => (name: string) => `some-electron-app-path-for-${kebabCase(name)}`,
    );

    di.override(setElectronAppPathInjectable, () => () => undefined);
    di.override(appNameInjectable, () => "some-electron-app-name");
    di.override(registerChannelInjectable, () => () => undefined);
    di.override(directoryForBundledBinariesInjectable, () => "some-bin-directory");
    di.override(spawnInjectable, () => () => { 
      return { 
        stderr: { on: jest.fn(), removeAllListeners: jest.fn() },
        stdout: { on: jest.fn(), removeAllListeners: jest.fn() },
        on: jest.fn(),
      } as any;
    });

    di.override(writeJsonFileInjectable, () => () => {
      throw new Error("Tried to write JSON file to file system without specifying explicit override.");
    });

    di.override(readJsonFileInjectable, () => () => {
      throw new Error("Tried to read JSON file from file system without specifying explicit override.");
    });

    di.override(readFileInjectable, () => () => {
      throw new Error("Tried to read file from file system without specifying explicit override.");
    });
  }

  return di;
};

const getInjectableFilePaths = memoize(() => [
  ...glob.sync("./**/*.injectable.{ts,tsx}", { cwd: __dirname }),
  ...glob.sync("../extensions/**/*.injectable.{ts,tsx}", { cwd: __dirname }),
  ...glob.sync("../common/**/*.injectable.{ts,tsx}", { cwd: __dirname }),
]);
