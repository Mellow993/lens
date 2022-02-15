/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import type { HelmEnv } from "../../get-helm-env/get-helm-env";
import type { HelmRepoConfig } from "./read-helm-config/read-helm-config";
import type { HelmRepo } from "../../../../common/helm-repo";
import {
  errorIsAboutNoRepositories,
} from "../update-helm-repositories/update-helm-repositories.injectable";
import type { ErrorHandledResponse } from "../with-error-handling";

interface Dependencies {
  readHelmConfig: (configPath: string) => Promise<HelmRepoConfig>
  addHelmRepository: (repo: HelmRepo) => Promise<void>
  getHelmEnv: () => Promise<HelmEnv>
  updateHelmRepositories: () => Promise<ErrorHandledResponse<void>>
}

export const getHelmRepositories = ({ readHelmConfig, addHelmRepository, getHelmEnv, updateHelmRepositories }: Dependencies) => {
  const _getHelmRepositories = async (): Promise<HelmRepo[]> => {
    const helmEnv = await getHelmEnv();

    const { callWasSuccessful, reasonToBypassErrorReporting } = await updateHelmRepositories();

    if (!callWasSuccessful && reasonToBypassErrorReporting === errorIsAboutNoRepositories) {
      await addHelmRepository({
        name: "bitnami",
        url: "https://charts.bitnami.com/bitnami",
      });
    }

    const { repositories } = await readHelmConfig(helmEnv.HELM_REPOSITORY_CONFIG);

    if (!repositories.length) {
      await addHelmRepository({
        name: "bitnami",
        url: "https://charts.bitnami.com/bitnami",
      });

      return await _getHelmRepositories();
    }

    return repositories.map((repo) => ({
      ...repo,
      cacheFilePath: `${helmEnv.HELM_REPOSITORY_CACHE}/${repo.name}-index.yaml`,
    }));
  };

  return _getHelmRepositories;
};
