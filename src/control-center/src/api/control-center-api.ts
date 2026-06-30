import { demoControlCenterAPI } from './demo-control-center-api.ts'
import type { ControlCenterApi } from '../../../shared/openpet-contracts.ts'

declare global {
  interface Window {
    controlCenterAPI?: ControlCenterApi
  }
}

const resolvedControlCenterApi: ControlCenterApi = window.controlCenterAPI || demoControlCenterAPI

if (typeof window !== 'undefined' && !window.controlCenterAPI) {
  window.controlCenterAPI = resolvedControlCenterApi
}

export const controlCenterAPI: ControlCenterApi = resolvedControlCenterApi
