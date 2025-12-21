import { ImageResponse } from '@vercel/og'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const token = searchParams.get('token') || 'BATR'
    const leverage = searchParams.get('leverage') || '1'
    const profit = searchParams.get('profit') || '0'
    const profitPercent = searchParams.get('profitPercent') || '0'

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0c12',
            backgroundImage: 'linear-gradient(135deg, #0a0c12 0%, #0f1117 100%)',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Background decoration */}
          <div
            style={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 400,
              height: 400,
              background: 'radial-gradient(circle, rgba(0,0,255,0.3) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -100,
              left: -100,
              width: 400,
              height: 400,
              background: 'radial-gradient(circle, rgba(0,255,0,0.2) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px',
              zIndex: 10,
            }}
          >
            {/* Logo/Title */}
            <div
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                background: 'linear-gradient(90deg, #0000FF 0%, #4444FF 100%)',
                backgroundClip: 'text',
                color: 'transparent',
                marginBottom: 40,
                display: 'flex',
              }}
            >
              BasedTraders
            </div>

            {/* Profitable Trade Badge */}
            <div
              style={{
                fontSize: 48,
                fontWeight: 'bold',
                color: '#22c55e',
                marginBottom: 60,
                display: 'flex',
              }}
            >
              🎯 Profitable Trade!
            </div>

            {/* Stats Container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                backgroundColor: 'rgba(15, 17, 23, 0.8)',
                padding: '40px 80px',
                borderRadius: 24,
                border: '2px solid rgba(0, 0, 255, 0.3)',
              }}
            >
              {/* Token */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 80 }}>
                <span style={{ color: '#9ca3af', fontSize: 32 }}>Token:</span>
                <span style={{ color: '#ffffff', fontSize: 36, fontWeight: 'bold' }}>{token}</span>
              </div>

              {/* Leverage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 80 }}>
                <span style={{ color: '#9ca3af', fontSize: 32 }}>Leverage:</span>
                <span style={{ color: '#0000FF', fontSize: 36, fontWeight: 'bold' }}>{leverage}x</span>
              </div>

              {/* Profit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 80 }}>
                <span style={{ color: '#9ca3af', fontSize: 32 }}>Profit:</span>
                <span style={{ color: '#22c55e', fontSize: 42, fontWeight: 'bold' }}>+${profit}</span>
              </div>

              {/* Return */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 80 }}>
                <span style={{ color: '#9ca3af', fontSize: 32 }}>Return:</span>
                <span style={{ color: '#22c55e', fontSize: 42, fontWeight: 'bold' }}>+{profitPercent}%</span>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                marginTop: 60,
                fontSize: 28,
                color: '#6b7280',
                display: 'flex',
              }}
            >
              Play at basetraders.vercel.app
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (error: any) {
    console.error('Error generating share image:', error)
    return new Response(`Failed to generate image: ${error.message}`, {
      status: 500,
    })
  }
}
