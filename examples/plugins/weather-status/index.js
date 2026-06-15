module.exports = function activate(ctx) {
  const normalizeUnits = (value) => value === 'imperial' ? 'imperial' : 'metric'

  const normalizeWeather = (raw, fallbackLocation, units) => {
    const condition = String(raw.condition || raw.summary || 'Unknown')
    const temperature = Number(raw.temperature ?? raw.temp ?? 0)
    const humidity = raw.humidity == null ? null : Number(raw.humidity)
    return {
      location: String(raw.location || fallbackLocation),
      units,
      condition,
      temperature: Number.isFinite(temperature) ? temperature : 0,
      humidity: Number.isFinite(humidity) ? humidity : null
    }
  }

  const formatWeather = (weather) => {
    const unitLabel = weather.units === 'imperial' ? 'F' : 'C'
    const humidity = weather.humidity == null ? '' : ` Humidity ${weather.humidity}%.`
    return `${weather.location}: ${weather.condition}, ${weather.temperature}${unitLabel}.${humidity}`
  }

  return {
    refresh: async (payload = {}) => {
      const config = ctx.config.get()
      const location = String(payload.location || config.location || 'Tokyo')
      const units = normalizeUnits(payload.units || config.units)
      const url = `https://api.weather.example.com/v1/current?location=${encodeURIComponent(location)}&units=${encodeURIComponent(units)}`
      const response = await ctx.network.fetch(url, {
        headers: {
          accept: 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Weather API request failed with status ${response.status}`)
      }

      const weather = normalizeWeather(JSON.parse(response.text || '{}'), location, units)
      const previousCount = await ctx.storage.get('refreshCount', 0)
      const refreshCount = Number(previousCount || 0) + 1
      await ctx.storage.set('lastWeather', weather)
      await ctx.storage.set('refreshCount', refreshCount)

      if (config.announce !== false) {
        await ctx.pet.say(formatWeather(weather))
      }

      return {
        ok: true,
        ...weather,
        refreshCount
      }
    },

    last: async () => {
      const weather = await ctx.storage.get('lastWeather', null)
      if (!weather) {
        await ctx.pet.say('No weather data yet.')
        return { ok: false, reason: 'missing' }
      }
      await ctx.pet.say(formatWeather(weather))
      return { ok: true, ...weather }
    }
  }
}
