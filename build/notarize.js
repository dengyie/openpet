exports.default = async function notarizeMac(context) {
  const { electronPlatformName, appOutDir, packager } = context
  if (electronPlatformName !== 'darwin') return

  const appName = packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`
  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID is missing.')
    return
  }

  let notarize
  try {
    notarize = require('@electron/notarize').notarize
  } catch (error) {
    console.log('Skipping notarization: @electron/notarize is not installed.')
    return
  }

  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId
  })
}
