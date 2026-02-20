#!/bin/bash
# OCI A1.Flex 인스턴스 자동 재시도 스크립트
# 용량 부족(Out of host capacity) 시 5분마다 재시도
# 성공하면 자동 중단 + 알림

export SUPPRESS_LABEL_WARNING=True

COMPARTMENT="ocid1.tenancy.oc1..aaaaaaaa6igeutahbldmnon4fymhvksfi5ns3ttsrhtutgha7olt3foyqdcq"
AD="UhPe:AP-CHUNCHEON-1-AD-1"
IMAGE="ocid1.image.oc1.ap-chuncheon-1.aaaaaaaabnbq2shdwisep2wtnuzwidj6acwfkfuylljlgaowky3okswwy26a"
SUBNET="ocid1.subnet.oc1.ap-chuncheon-1.aaaaaaaazbcg6bu6kvcsk32uu56qtxxrep3ra2zsomf77l464ssdukembphq"
SSH_KEY="$HOME/.ssh/travelplanner-oci.pub"
LOG_FILE="/tmp/oci-a1-retry.log"

OCPUS=2
MEMORY_GB=12
BOOT_GB=50
DISPLAY_NAME="travelplanner-a1"

RETRY_INTERVAL=300  # 5분
MAX_RETRIES=288     # 24시간 (288 × 5분)

echo "=== OCI A1.Flex 자동 생성 스크립트 ===" | tee "$LOG_FILE"
echo "설정: ${OCPUS} OCPU, ${MEMORY_GB}GB RAM, ${BOOT_GB}GB Boot" | tee -a "$LOG_FILE"
echo "재시도 간격: ${RETRY_INTERVAL}초, 최대: ${MAX_RETRIES}회" | tee -a "$LOG_FILE"
echo "시작 시간: $(date)" | tee -a "$LOG_FILE"
echo "로그: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

for i in $(seq 1 $MAX_RETRIES); do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 시도 #$i / $MAX_RETRIES" | tee -a "$LOG_FILE"

    RESULT=$(oci compute instance launch \
        --compartment-id "$COMPARTMENT" \
        --availability-domain "$AD" \
        --shape "VM.Standard.A1.Flex" \
        --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}" \
        --image-id "$IMAGE" \
        --subnet-id "$SUBNET" \
        --display-name "$DISPLAY_NAME" \
        --assign-public-ip true \
        --boot-volume-size-in-gbs "$BOOT_GB" \
        --ssh-authorized-keys-file "$SSH_KEY" \
        2>&1)

    if echo "$RESULT" | grep -q '"lifecycle-state"'; then
        echo "" | tee -a "$LOG_FILE"
        echo "✅ 인스턴스 생성 성공!" | tee -a "$LOG_FILE"
        echo "$RESULT" | tee -a "$LOG_FILE"

        # 인스턴스 ID 추출
        INSTANCE_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        echo "" | tee -a "$LOG_FILE"
        echo "인스턴스 ID: $INSTANCE_ID" | tee -a "$LOG_FILE"

        # macOS 알림
        osascript -e 'display notification "A1.Flex 인스턴스 생성 완료!" with title "OCI" sound name "Glass"' 2>/dev/null

        echo "" | tee -a "$LOG_FILE"
        echo "=== 다음 단계 ===" | tee -a "$LOG_FILE"
        echo "1. 퍼블릭 IP 확인: oci compute instance list-vnics --instance-id $INSTANCE_ID" | tee -a "$LOG_FILE"
        echo "2. SSH 접속 후 서버 셋업 진행" | tee -a "$LOG_FILE"
        exit 0
    fi

    if echo "$RESULT" | grep -q "Out of host capacity"; then
        echo "  ❌ 용량 부족 — ${RETRY_INTERVAL}초 후 재시도..." | tee -a "$LOG_FILE"
    else
        echo "  ⚠️ 예상치 못한 오류:" | tee -a "$LOG_FILE"
        echo "$RESULT" | tee -a "$LOG_FILE"
        echo "  ${RETRY_INTERVAL}초 후 재시도..." | tee -a "$LOG_FILE"
    fi

    sleep "$RETRY_INTERVAL"
done

echo "❌ 최대 재시도 횟수 초과 ($MAX_RETRIES회)" | tee -a "$LOG_FILE"
exit 1
