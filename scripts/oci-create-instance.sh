#!/bin/bash
# OCI A1 Flex 인스턴스 자동 재시도 스크립트
# 용량 부족 시 60초 간격으로 재시도

export SUPPRESS_LABEL_WARNING=True

AD="UhPe:AP-CHUNCHEON-1-AD-1"
COMPARTMENT="ocid1.tenancy.oc1..aaaaaaaa6igeutahbldmnon4fymhvksfi5ns3ttsrhtutgha7olt3foyqdcq"
SHAPE="VM.Standard.A1.Flex"
IMAGE="ocid1.image.oc1.ap-chuncheon-1.aaaaaaaasonaqsoc5d4nd3wks6jh5jzqgiq2a3ewqlfrupyjoog2wvpzk6ta"
SUBNET="ocid1.subnet.oc1.ap-chuncheon-1.aaaaaaaazbcg6bu6kvcsk32uu56qtxxrep3ra2zsomf77l464ssdukembphq"
SSH_KEY="$HOME/.ssh/travelplanner-oci.pub"
DISPLAY_NAME="travelplanner-prod"
OCPUS=2
MEMORY_GB=12

ATTEMPT=0
MAX_ATTEMPTS=1440  # 24시간 (60초 x 1440)

echo "============================================"
echo "  OCI A1 Flex instance auto-retry script"
echo "  Shape: $SHAPE ($OCPUS OCPU / ${MEMORY_GB}GB)"
echo "  Region: ap-chuncheon-1"
echo "  Max retries: $MAX_ATTEMPTS (24h)"
echo "============================================"
echo ""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TIMESTAMP] Attempt #$ATTEMPT..."

  RESULT=$(oci compute instance launch \
    --availability-domain "$AD" \
    --compartment-id "$COMPARTMENT" \
    --shape "$SHAPE" \
    --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEMORY_GB}" \
    --image-id "$IMAGE" \
    --subnet-id "$SUBNET" \
    --assign-public-ip true \
    --display-name "$DISPLAY_NAME" \
    --ssh-authorized-keys-file "$SSH_KEY" \
    2>&1)

  # Success: response contains lifecycle-state
  if echo "$RESULT" | grep -q '"lifecycle-state"'; then
    echo ""
    echo "============================================"
    echo "  Instance created successfully!"
    echo "============================================"
    echo "$RESULT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)['data']
    print(f\"  Instance ID: {data.get('id', 'N/A')}\")
    print(f\"  State: {data.get('lifecycle-state', 'N/A')}\")
    print(f\"  Display Name: {data.get('display-name', 'N/A')}\")
except: pass
" 2>/dev/null
    echo ""
    echo "  Waiting for public IP assignment..."
    sleep 30
    INSTANCE_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
    if [ -n "$INSTANCE_ID" ]; then
      VNIC_ATTACH=$(oci compute vnic-attachment list \
        --compartment-id "$COMPARTMENT" \
        --instance-id "$INSTANCE_ID" \
        --query 'data[0]."vnic-id"' --raw-output 2>/dev/null)
      if [ -n "$VNIC_ATTACH" ]; then
        PUBLIC_IP=$(oci network vnic get --vnic-id "$VNIC_ATTACH" \
          --query 'data."public-ip"' --raw-output 2>/dev/null)
        echo "  Public IP: $PUBLIC_IP"
        echo ""
        echo "  SSH: ssh -i ~/.ssh/travelplanner-oci ubuntu@$PUBLIC_IP"
      fi
    fi
    echo "============================================"
    exit 0
  fi

  # Check error type
  if echo "$RESULT" | grep -qi "out of.*capacity\|InternalError\|Out of host capacity"; then
    echo "  -> Capacity unavailable. Retry in 60s..."
  elif echo "$RESULT" | grep -qi "LimitExceeded"; then
    echo "  -> Resource limit exceeded. Check existing instances."
    echo "$RESULT"
    exit 1
  elif echo "$RESULT" | grep -qi "NotAuthorized\|InvalidParameter\|NotAuthenticated"; then
    echo "  -> Auth/parameter error (not retryable):"
    echo "$RESULT" | head -10
    exit 1
  else
    echo "  -> Other error (retrying):"
    echo "$RESULT" | head -5
  fi

  sleep 60
done

echo "Max attempts ($MAX_ATTEMPTS) reached."
exit 1
