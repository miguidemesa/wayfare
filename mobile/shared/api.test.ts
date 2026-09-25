import { api, ApiError, layOutDays, login, setUnauthorizedHandler } from "./api";
import { learnServerOffset } from "./trip";

function respond(status: number, body: unknown = {}) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => setUnauthorizedHandler(null));

describe("request", () => {
  it("reports a lost session when a signed-in request gets a 401", async () => {
    const onLost = jest.fn();
    setUnauthorizedHandler(onLost);
    fetchMock.mockReturnValue(respond(401, { error: "Not signed in" }));
    await expect(api.get("/api/trips")).rejects.toMatchObject({ status: 401, message: "Not signed in" });
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it("treats a 401 from sign-in as a wrong password, not a lost session", async () => {
    const onLost = jest.fn();
    setUnauthorizedHandler(onLost);
    fetchMock.mockReturnValue(respond(401, { error: "Incorrect email or password" }));
    await expect(login("a@b.co", "nope")).rejects.toBeInstanceOf(ApiError);
    expect(onLost).not.toHaveBeenCalled();
  });

  it("turns a network failure into status 0", async () => {
    fetchMock.mockReturnValue(Promise.reject(new TypeError("Network request failed")));
    await expect(api.get("/api/trips")).rejects.toMatchObject({ status: 0 });
  });
});

describe("layOutDays", () => {
  // UTC+8 server: day dates are 16:00Z the day before.
  beforeEach(() => learnServerOffset("2027-03-13T16:00:00.000Z"));

  const posted = () => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

  it("creates each missing date in order, across a month end", async () => {
    fetchMock.mockImplementation(() => respond(201, { day: { id: "x" } }));
    const existing = [{ date: "2027-03-30T16:00:00.000Z" }]; // 31 March
    const created = await layOutDays("t1", "2027-03-30", "2027-04-02", existing);
    expect(created).toBe(3);
    expect(posted().map((b) => b.date)).toEqual(["2027-03-30", "2027-04-01", "2027-04-02"]);
  });

  it("splits cities across the trip in order", async () => {
    fetchMock.mockImplementation(() => respond(201, { day: { id: "x" } }));
    await layOutDays("t1", "2027-03-14", "2027-03-17", [], ["Tokyo", "Kyoto"]);
    expect(posted().map((b) => b.city)).toEqual(["Tokyo", "Tokyo", "Kyoto", "Kyoto"]);
  });

  it("lays out trips longer than a month", async () => {
    fetchMock.mockImplementation(() => respond(201, { day: { id: "x" } }));
    expect(await layOutDays("t1", "2027-06-01", "2027-07-15", [])).toBe(45);
  });
});
