#!/usr/bin/env bash
# Abre um backup criptografado do Mio da Feada, mostra o resumo e apaga o que ficou
# sem criptografia (para confirmar que a frase-senha funciona, sem deixar rascunhos soltos).
#
# Uso (no Git Bash ou WSL):
#   bash scripts/abrir-backup.sh caminho/do/backup-mio-1.zip            # confere e limpa
#   bash scripts/abrir-backup.sh caminho/do/backup-mio-1.zip --manter   # deixa a pasta aberta
#
# Ele pergunta a frase-senha (nada aparece na tela enquanto você digita).
# Se preferir passar a senha por variável: BACKUP_PASSPHRASE='...' bash scripts/abrir-backup.sh ...
set -euo pipefail

ZIP="${1:-}"
MANTER="${2:-}"
if [ ! -f "$ZIP" ]; then
  echo "Uso: bash scripts/abrir-backup.sh <backup-mio-N.zip> [--manter]"
  exit 1
fi

DIR="$(cd "$(dirname "$ZIP")" && pwd)/aberto-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"
if [ "$MANTER" != "--manter" ]; then
  trap 'rm -rf "$DIR"' EXIT   # apaga o conteúdo aberto, mesmo se der erro
fi

unzip -q "$ZIP" -d "$DIR"

# Se a senha vier por variável, tira o \r (retorno de carro) que o Windows costuma acrescentar
# ao fim do texto e que faz uma senha "igual" falhar com bad decrypt.
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  BACKUP_PASSPHRASE="$(printf '%s' "$BACKUP_PASSPHRASE" | tr -d '\r\n')"
  export BACKUP_PASSPHRASE
fi

echo "Digite a frase-senha do backup (nada aparece na tela) e tecle Enter:"
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$DIR/backup.tar.gz.enc" -out "$DIR/backup.tar.gz" ${BACKUP_PASSPHRASE:+-pass env:BACKUP_PASSPHRASE}; then
  echo
  echo "✗ Não abriu: a senha digitada é diferente da cadastrada no GitHub (BACKUP_PASSPHRASE)."
  exit 1
fi

tar -xzf "$DIR/backup.tar.gz" -C "$DIR"

echo
echo "✓ Senha correta. Conteúdo do backup:"
node -e "
const d = require(process.argv[1] + '/backup/dados.json');
console.log('  gerado em:', d.exportedAt);
for (const [k, v] of Object.entries(d.resumo)) console.log('  ' + k + ':', v);
" "$DIR"
ls "$DIR/backup/fotos" | sed 's/^/  foto: /'

if [ "$MANTER" = "--manter" ]; then
  echo
  echo "Pasta aberta mantida em: $DIR"
  echo "(ela tem os rascunhos SEM criptografia; apague quando terminar)"
else
  echo
  echo "O conteúdo aberto foi apagado. O arquivo .zip original continua intacto."
fi
