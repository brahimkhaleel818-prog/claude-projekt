-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('SUCCESS', 'NO_DATA', 'FAILED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PCT_INCREASE', 'PCT_DECREASE', 'ABOVE_AMOUNT', 'BELOW_AMOUNT', 'DAILY_HIGH', 'DAILY_LOW');

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originAddress" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "destAddress" TEXT NOT NULL,
    "destLat" DOUBLE PRECISION NOT NULL,
    "destLng" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reverseRouteId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMPTZ(3),
    "lastSuccessAt" TIMESTAMPTZ(3),
    "lastStatus" "RunStatus",
    "lastError" TEXT,
    "consecutiveFails" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FetchRun" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "status" "RunStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FetchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceMeasurement" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "runId" TEXT,
    "provider" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT,
    "category" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'UPFRONT',
    "priceValue" DECIMAL(10,2) NOT NULL,
    "priceLow" DECIMAL(10,2),
    "priceHigh" DECIMAL(10,2),
    "displayText" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "surgeMultiplier" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "pickupEtaMin" INTEGER,
    "originAddress" TEXT NOT NULL,
    "destAddress" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" TEXT NOT NULL,
    "localTime" TEXT NOT NULL,
    "localHour" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "routeId" TEXT,
    "categoryKey" TEXT,
    "type" "AlertType" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY['dashboard']::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastTriggeredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT,
    "routeId" TEXT,
    "categoryKey" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "deliveries" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "beatAt" TIMESTAMPTZ(3) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "info" JSONB,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "query" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("query")
);

-- CreateIndex
CREATE UNIQUE INDEX "Route_reverseRouteId_key" ON "Route"("reverseRouteId");

-- CreateIndex
CREATE INDEX "Route_active_nextRunAt_idx" ON "Route"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "FetchRun_routeId_startedAt_idx" ON "FetchRun"("routeId", "startedAt");

-- CreateIndex
CREATE INDEX "FetchRun_startedAt_idx" ON "FetchRun"("startedAt");

-- CreateIndex
CREATE INDEX "PriceMeasurement_routeId_categoryKey_fetchedAt_idx" ON "PriceMeasurement"("routeId", "categoryKey", "fetchedAt");

-- CreateIndex
CREATE INDEX "PriceMeasurement_routeId_fetchedAt_idx" ON "PriceMeasurement"("routeId", "fetchedAt");

-- CreateIndex
CREATE INDEX "PriceMeasurement_isDemo_idx" ON "PriceMeasurement"("isDemo");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_reverseRouteId_fkey" FOREIGN KEY ("reverseRouteId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FetchRun" ADD CONSTRAINT "FetchRun_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMeasurement" ADD CONSTRAINT "PriceMeasurement_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMeasurement" ADD CONSTRAINT "PriceMeasurement_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FetchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
