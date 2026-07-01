// FeatureGate hides children when the given feature flag is turned off in Firebase.
// The developer (isDeveloper: true) always sees all features.
import { useFeatureFlags } from '../context/FeatureFlagsContext'

export default function FeatureGate({ flag, children, fallback = null }) {
  const { isEnabled } = useFeatureFlags()
  if (!isEnabled(flag)) return fallback
  return children
}
