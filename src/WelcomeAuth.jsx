import { useState, useRef, useEffect } from "react";
import { Sprout, ShoppingBasket, ArrowRight, ChevronLeft, RefreshCw, MapPin } from "lucide-react";
import { supabase } from "./lib/supabaseClient";

/* ----------------------------- design tokens ------------------------------
   Same palette/fonts as the rest of AgriTrade, so this screen matches the
   Home/Trade/Chat/Profile screens exactly.
----------------------------------------------------------------------------*/
const C = {
  bg: "#F5F6F0", ink: "#1B2420", sub: "#6B7268", line: "#E4E1D3",
  primary: "#1E4732", clay: "#B65C38", teal: "#2A6773", gold: "#D98A2B",
};



/* ------------------------------- OTP input --------------------------------
   6 separate boxes, auto-advance on type, backspace moves back a box.
----------------------------------------------------------------------------*/
function OtpInput({ value, onChange, length = 6 }) {
  const refs = useRef([]);
  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

  const setDigit = (i, d) => {
    const next = [...digits];
    next[i] = d;
    onChange(next.join(""));
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => onKeyDown(i, e)}
          inputMode="numeric"
          maxLength={1}
          className="w-11 h-13 h-[52px] rounded-xl border border-[#E4E1D3] bg-white text-center text-[20px] font-semibold text-[#1B2420] outline-none focus:border-[#1E4732]"
        />
      ))}
    </div>
  );
}

/* --------------------------------- Screen ---------------------------------- */
export default function WelcomeAuth({ onAuthed }) {
  const [step, setStep] = useState("role");      // role -> phone -> otp -> name -> location
  const [role, setRole] = useState(null);         // "farmer" | "buyer"
  const [phone, setPhone] = useState("");         // digits only, no +91
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState({
    city: "",
    district: "",
    latitude: null,
    longitude: null,
  });
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const e164 = "+91" + phone.replace(/\D/g, "");

  const requestCurrentLocation = () => {
    if (!navigator?.geolocation) {
      setError("This browser does not support geolocation. You can still enter your city and district manually.");
      return;
    }

    setError("");
    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation((prev) => ({
          ...prev,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
        setLocationLoading(false);
      },
      (geoError) => {
        setLocationLoading(false);
        const msg = geoError.code === 1
          ? "Location permission was denied. You can still enter your city and district manually."
          : "We couldn't access your current location. You can still enter your city and district manually.";
        setError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const resolveManualLocation = async () => {
    if (location.latitude !== null && location.longitude !== null) return location;

    const place = [location.city.trim(), location.district.trim(), "Maharashtra"]
      .filter(Boolean)
      .join(", ");
    const response = await fetch(`/api/geocode?place=${encodeURIComponent(place)}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "We could not find that location.");
    }

    return {
      ...location,
      city: result.city || location.city,
      district: result.district || location.district,
      latitude: result.latitude,
      longitude: result.longitude,
    };
  };

  const sendOtp = async () => {
    setError("");
    if (phone.replace(/\D/g, "").length !== 10) return setError("Enter a valid 10-digit number.");
    setLoading(true);
    // Supabase sends the SMS itself — Twilio is wired up as the SMS provider
    // in Supabase Dashboard -> Authentication -> Providers -> Phone.
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);
    if (error) return setError(error.message);
    setResendIn(30);
    setStep("otp");
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return setError("Enter the 6-digit code.");
    setError("");
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: e164,
      token: otp,
      type: "sms",
    });
    if (error) { setLoading(false); return setError(error.message); }

    const userId = data.user.id;
    // Check if this phone number already has a profile (returning user).
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    setLoading(false);
    if (profile) {
      onAuthed(profile);           // returning user -> straight into the app
    } else {
      setStep("name");             // new user -> collect name once
    }
  };

  const finishSignup = async () => {
    if (!name.trim()) return setError("Enter your name.");
    if (!location.city.trim() && !location.district.trim() && location.latitude === null && location.longitude === null) {
      return setError("Enter your city and district, or use your current location.");
    }

    setError("");
    setLoading(true);
    let resolvedLocation;
    try {
      resolvedLocation = await resolveManualLocation();
    } catch (resolveError) {
      setLoading(false);
      return setError(resolveError.message);
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile, error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        name: name.trim(),
        phone: e164,
        role,
        city: resolvedLocation.city.trim() || null,
        district: resolvedLocation.district.trim() || null,
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
      })
      .select()
      .single();
    setLoading(false);
    if (error) return setError(error.message);
    onAuthed(profile);
  };

  const accent = role === "buyer" ? C.teal : C.clay;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#EDEAE0] px-4">
      <div className="w-full max-w-[380px] bg-[#F5F6F0] rounded-[1.75rem] shadow-xl overflow-hidden">
        {/* header */}
        <div className="bg-[#1B2420] px-6 pt-9 pb-7 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5" />
          {step !== "role" && (
            <button
              onClick={() => {
                setError("");
                setStep(step === "otp" ? "phone" : step === "location" ? "name" : step === "name" ? "otp" : "role");
              }}
              className="absolute left-5 top-9 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
            >
              <ChevronLeft size={18} color="#fff" />
            </button>
          )}
          <p className="text-[24px] font-semibold text-white text-center">AgriLinkage</p>
          <p className="text-[12px] text-white/60 text-center mt-1">
            Direct from farm gate to the right buyer
          </p>
        </div>

        <div className="px-6 py-7">
          {error && (
            <p className="text-[12px] text-[#B23B3B] bg-[#F6E4E4] rounded-lg px-3 py-2 mb-4">{error}</p>
          )}

          {/* -------------------------- STEP 1: role -------------------------- */}
          {step === "role" && (
            <>
              <p className="text-[13px] text-[#6B7268] mb-4 text-center">
                Tell us who you are to get started
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setRole("farmer"); setStep("phone"); }}
                  className="flex items-center gap-3 border-2 border-[#E4E1D3] hover:border-[#B65C38] rounded-2xl px-4 py-4 text-left transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-[#F5E3DA] flex items-center justify-center shrink-0">
                    <Sprout size={22} color={C.clay} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#1B2420]">I'm a Farmer</p>
                    <p className="text-[12px] text-[#6B7268]">Sell your produce to verified buyers</p>
                  </div>
                </button>
                <button
                  onClick={() => { setRole("buyer"); setStep("phone"); }}
                  className="flex items-center gap-3 border-2 border-[#E4E1D3] hover:border-[#2A6773] rounded-2xl px-4 py-4 text-left transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-[#DFEBEC] flex items-center justify-center shrink-0">
                    <ShoppingBasket size={22} color={C.teal} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#1B2420]">I'm a Buyer</p>
                    <p className="text-[12px] text-[#6B7268]">Source quality lots directly from farmers</p>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* -------------------------- STEP 2: phone ------------------------- */}
          {step === "phone" && (
            <>
              <p className="text-[13px] text-[#6B7268] mb-1 text-center">
                Enter your mobile number
              </p>
              <p className="text-[11px] text-[#8B9086] mb-4 text-center">
                We'll text you a one-time code to verify it
              </p>
              <div className="flex items-center gap-2 bg-white border border-[#E4E1D3] rounded-xl px-3 h-13 h-[52px] mb-4">
                <span className="text-[15px] font-semibold text-[#1B2420]">+91</span>
                <div className="w-px h-5 bg-[#E4E1D3]" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="98765 43210"
                  inputMode="numeric"
                  className="flex-1 bg-transparent outline-none text-[15px] text-[#1B2420] placeholder:text-[#B7BDAF]"
                />
              </div>
              <button
                onClick={sendOtp}
                disabled={loading}
                className="w-full h-12 rounded-xl text-white font-semibold text-[15px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {loading ? "Sending code…" : <>Send OTP <ArrowRight size={16} color="#fff" /></>}
              </button>
            </>
          )}

          {/* -------------------------- STEP 3: otp --------------------------- */}
          {step === "otp" && (
            <>
              <p className="text-[13px] text-[#6B7268] mb-1 text-center">
                Enter the 6-digit code sent to
              </p>
              <p className="text-[14px] font-semibold text-[#1B2420] mb-4 text-center">
                +91 {phone}
              </p>
              <div className="mb-4">
                <OtpInput value={otp} onChange={setOtp} />
              </div>
              <button
                onClick={verifyOtp}
                disabled={loading}
                className="w-full h-12 rounded-xl text-white font-semibold text-[15px] flex items-center justify-center gap-1.5 disabled:opacity-60 mb-3"
                style={{ backgroundColor: accent }}
              >
                {loading ? "Verifying…" : <>Verify & continue <ArrowRight size={16} color="#fff" /></>}
              </button>
              <button
                onClick={sendOtp}
                disabled={resendIn > 0 || loading}
                className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#6B7268] disabled:opacity-50"
              >
                <RefreshCw size={12} /> {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
            </>
          )}

          {/* -------------------------- STEP 4: name (new users) --------------- */}
          {step === "name" && (
            <>
              <p className="text-[13px] text-[#6B7268] mb-4 text-center">
                Almost there — what should we call you?
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full h-12 rounded-xl border border-[#E4E1D3] bg-white px-4 mb-4 text-[14px] text-[#1B2420] outline-none focus:border-[#1E4732]"
              />
              <button
                onClick={() => {
                  if (!name.trim()) return setError("Enter your name.");
                  setError("");
                  setStep("location");
                }}
                disabled={loading}
                className="w-full h-12 rounded-xl text-white font-semibold text-[15px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                Continue <ArrowRight size={16} color="#fff" />
              </button>
            </>
          )}

          {/* ------------------------- STEP 5: location ------------------------- */}
          {step === "location" && (
            <>
              <p className="text-[13px] text-[#6B7268] mb-1 text-center">
                Add your location
              </p>
              <p className="text-[11px] text-[#8B9086] mb-4 text-center">
                We use this to suggest nearby mandis, warehouses, and schemes.
              </p>

              <button
                onClick={requestCurrentLocation}
                disabled={loading || locationLoading}
                className="w-full h-12 rounded-xl border border-[#E4E1D3] bg-white text-[#1B2420] font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60 mb-4"
              >
                <MapPin size={16} color={accent} />
                {locationLoading ? "Getting location…" : "Use my current location"}
              </button>

              <div className="space-y-3 mb-4">
                <input
                  value={location.city}
                  onChange={(e) => setLocation((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                  className="w-full h-12 rounded-xl border border-[#E4E1D3] bg-white px-4 text-[14px] text-[#1B2420] outline-none focus:border-[#1E4732]"
                />
                <input
                  value={location.district}
                  onChange={(e) => setLocation((prev) => ({ ...prev, district: e.target.value }))}
                  placeholder="District"
                  className="w-full h-12 rounded-xl border border-[#E4E1D3] bg-white px-4 text-[14px] text-[#1B2420] outline-none focus:border-[#1E4732]"
                />
              </div>

              {location.latitude !== null && location.longitude !== null && (
                <div className="rounded-xl border border-[#D9E8DF] bg-[#EEF4F1] px-3 py-2 mb-4 text-[11px] text-[#1B2420]">
                  Current coordinates captured: <span className="font-semibold">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
                </div>
              )}

              <button
                onClick={finishSignup}
                disabled={loading || locationLoading}
                className="w-full h-12 rounded-xl text-white font-semibold text-[15px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {loading ? "Creating account…" : <>Create account <ArrowRight size={16} color="#fff" /></>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
