import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 }, // Ramp up to 20 users
    { duration: "1m", target: 20 },  // Stay at 20 users
    { duration: "15s", target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete under 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  // 1. Fetch homepage
  const resHome = http.get(BASE_URL);
  check(resHome, {
    "status is 200": (r) => r.status === 200,
  });
  sleep(1);

  // 2. Query listings search
  const resSearch = http.get(`${BASE_URL}/api/listings?q=galaxy&page=1`);
  check(resSearch, {
    "search returns 200": (r) => r.status === 200,
    "search has data": (r) => r.json().data !== undefined,
  });
  sleep(1.5);

  // 3. Check health endpoint
  const resHealth = http.get(`${BASE_URL}/api/health`);
  check(resHealth, {
    "health check is 200": (r) => r.status === 200,
  });
  sleep(2);
}
