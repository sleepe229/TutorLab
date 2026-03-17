#!/bin/bash
# Script to automatically load nvm and use the correct Node.js version

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js version from .nvmrc if it exists
if [ -f .nvmrc ]; then
  nvm use
fi

# Run the command passed as arguments
exec "$@"

