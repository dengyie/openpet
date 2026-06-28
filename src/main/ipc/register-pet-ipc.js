const { registerPetMenuIpc } = require('./register-pet-menu-ipc')
const { registerPetMovementIpc } = require('./register-pet-movement-ipc')
const { registerPetWindowIpc } = require('./register-pet-window-ipc')

const registerPetIpc = (context) => {
  registerPetMovementIpc(context)
  registerPetWindowIpc(context)
  registerPetMenuIpc(context)
}

module.exports = {
  registerPetIpc
}
