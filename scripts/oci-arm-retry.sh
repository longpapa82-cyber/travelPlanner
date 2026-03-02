#!/bin/bash
# OCI ARM Instance Auto-Retry Script
# Retries creating VM.Standard.A1.Flex until capacity becomes available
# Managed by macOS LaunchAgent: com.travelplanner.oci-arm-retry
# Usage: ./scripts/oci-arm-retry.sh [ocpu] [memory_gb]
#   Default: 4 OCPU, 24 GB

set -uo pipefail
export SUPPRESS_LABEL_WARNING=True

# Configuration
OCPUS="${1:-4}"
MEMORY_GB="${2:-24}"
DISPLAY_NAME="travelplanner-arm"
COMPARTMENT_ID="ocid1.tenancy.oc1..aaaaaaaa6igeutahbldmnon4fymhvksfi5ns3ttsrhtutgha7olt3foyqdcq"
AD="UhPe:AP-CHUNCHEON-1-AD-1"
IMAGE_ID="ocid1.image.oc1.ap-chuncheon-1.aaaaaaaasonaqsoc5d4nd3wks6jh5jzqgiq2a3ewqlfrupyjoog2wvpzk6ta"
SUBNET_ID="ocid1.subnet.oc1.ap-chuncheon-1.aaaaaaaazbcg6bu6kvcsk32uu56qtxxrep3ra2zsomf77l464ssdukembphq"
SSH_KEY_FILE="$HOME/.ssh/travelplanner-oci.pub"
SHAPE="VM.Standard.A1.Flex"

# Retry settings
RETRY_INTERVAL=60
PID_FILE="/tmp/oci-arm-retry.pid"

# Skip if instance already created
if [ -f /tmp/oci-arm-ip.txt ]; then
    echo "ARM instance already created (IP: $(cat /tmp/oci-arm-ip.txt)). Remove /tmp/oci-arm-ip.txt to retry."
    exit 0
fi

echo $$ > "$PID_FILE"
echo "=== OCI ARM Retry Started: $(date) ==="
echo "Shape: $SHAPE | Spec: ${OCPUS} OCPU / ${MEMORY_GB}GB | Retry: every ${RETRY_INTERVAL}s (unlimited)"

ATTEMPT=0
while true; do
    ATTEMPT=$((ATTEMPT + 1))
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] Attempt $ATTEMPT — Creating ${OCPUS} OCPU / ${MEMORY_GB}GB instance..."

    RESULT=$(oci compute instance launch \
        --compartment-id "$COMPARTMENT_ID" \
        --availability-domain "$AD" \
        --shape "$SHAPE" \
        --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}" \
        --display-name "$DISPLAY_NAME" \
        --image-id "$IMAGE_ID" \
        --subnet-id "$SUBNET_ID" \
        --assign-public-ip true \
        --ssh-authorized-keys-file "$SSH_KEY_FILE" \
        --wait-for-state RUNNING \
        --max-wait-seconds 300 \
        2>&1) || true

    if echo "$RESULT" | grep -q '"lifecycle-state": "RUNNING"'; then
        echo ""
        echo "=== SUCCESS! Instance created at $(date) ==="

        INSTANCE_ID=$(echo "$RESULT" | grep '"id"' | head -1 | cut -d'"' -f4)
        echo "Instance ID: $INSTANCE_ID"

        sleep 10
        PUBLIC_IP=$(oci compute instance list-vnics \
            --instance-id "$INSTANCE_ID" \
            --query "data[0].\"public-ip\"" \
            --raw-output 2>/dev/null) || PUBLIC_IP="(pending)"

        echo "Public IP: $PUBLIC_IP"
        echo "$PUBLIC_IP" > /tmp/oci-arm-ip.txt
        echo "$INSTANCE_ID" > /tmp/oci-arm-instance-id.txt

        # macOS desktop notification
        osascript -e "display notification \"IP: $PUBLIC_IP\" with title \"OCI ARM Instance Created!\" sound name \"Glass\"" 2>/dev/null || true

        echo "Next: ssh -i ~/.ssh/travelplanner-oci ubuntu@$PUBLIC_IP"
        rm -f "$PID_FILE"
        exit 0
    fi

    if echo "$RESULT" | grep -q "Out of capacity\|Out of host capacity\|InternalError\|LimitExceeded"; then
        echo "[$TIMESTAMP] Out of capacity. Retry in ${RETRY_INTERVAL}s..."
    else
        echo "[$TIMESTAMP] Unexpected: $(echo "$RESULT" | tail -3)"
    fi

    sleep "$RETRY_INTERVAL"
done
