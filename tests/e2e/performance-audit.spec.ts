import { test, expect } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from '../../scripts/lib/e2e-admin-config.js';

// 페이지 성능 측정 테스트
test.describe('🚀 성능 Audit 테스트', () => {
  
  test('퍼블릭 홈페이지 성능 측정', async ({ page }) => {
    const metrics: any = {};
    
    // Performance Observer 설정
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            (window as any).webVitals = (window as any).webVitals || {};
            (window as any).webVitals[entry.name] = entry.startTime;
          });
        }).observe({ entryTypes: ['web-vitals'] });
        
        setTimeout(resolve, 100);
      });
    });
    
    const startTime = Date.now();
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    // 리소스 로딩 측정
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((r: any) => ({
        name: r.name.split('/').pop(),
        duration: Math.round(r.duration),
        size: r.transferSize,
        type: r.initiatorType
      }));
    });
    
    // JavaScript 번들 크기 측정
    const jsResources = resources.filter((r: any) => r.name?.endsWith('.js'));
    const totalJsSize = jsResources.reduce((sum: number, r: any) => sum + (r.size || 0), 0);
    
    // CSS 번들 크기 측정
    const cssResources = resources.filter((r: any) => r.name?.endsWith('.css'));
    const totalCssSize = cssResources.reduce((sum: number, r: any) => sum + (r.size || 0), 0);
    
    // LCP 측정
    const lcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('largest-contentful-paint');
      return entries.length > 0 ? Math.round(entries[entries.length - 1].startTime) : null;
    });
    
    // FCP 측정
    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('first-contentful-paint');
      return entries.length > 0 ? Math.round(entries[0].startTime) : null;
    });
    
    // TTFB 측정
    const ttfb = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return nav ? Math.round(nav.responseStart - nav.startTime) : null;
    });

    console.log('\n📊 퍼블릭 홈페이지 성능 측정 결과');
    console.log('=====================================');
    console.log(`⏱️  페이지 로드 시간: ${loadTime}ms`);
    console.log(`⏱️  TTFB: ${ttfb}ms`);
    console.log(`⏱️  FCP: ${fcp}ms`);
    console.log(`⏱️  LCP: ${lcp}ms`);
    console.log(`📦 JS 총 크기: ${(totalJsSize / 1024).toFixed(2)} KB`);
    console.log(`📦 CSS 총 크기: ${(totalCssSize / 1024).toFixed(2)} KB`);
    
    console.log('\n🔍 상위 JS 리소스:');
    jsResources
      .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
      .slice(0, 5)
      .forEach((r: any) => {
        console.log(`   ${r.name}: ${((r.size || 0) / 1024).toFixed(2)} KB (${r.duration}ms)`);
      });
    
    console.log('\n🔍 상위 CSS 리소스:');
    cssResources
      .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
      .slice(0, 3)
      .forEach((r: any) => {
        console.log(`   ${r.name}: ${((r.size || 0) / 1024).toFixed(2)} KB (${r.duration}ms)`);
      });
    
    // 성능 기준 체크
    expect(loadTime, '페이지 로드 시간이 3초를 초과합니다').toBeLessThan(3000);
    expect(ttfb, 'TTFB가 600ms를 초과합니다').toBeLessThan(600);
    expect(totalJsSize, 'JS 크기가 1MB를 초과합니다').toBeLessThan(1024 * 1024);
  });

  test('관리자 대시보드 성능 측정', async ({ page }) => {
    // 로그인
    await page.goto('/admin/login');
    await page.getByTestId('admin-login-email').fill(E2E_ADMIN_EMAIL);
    await page.getByTestId('admin-login-password').fill(E2E_ADMIN_PASSWORD);
    await page.getByTestId('admin-login-submit').click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    
    const startTime = Date.now();
    await page.goto('/admin', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    // 리소스 로딩 측정
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((r: any) => ({
        name: r.name.split('/').pop(),
        duration: Math.round(r.duration),
        size: r.transferSize,
        type: r.initiatorType
      }));
    });
    
    const jsResources = resources.filter((r: any) => r.name?.endsWith('.js'));
    const totalJsSize = jsResources.reduce((sum: number, r: any) => sum + (r.size || 0), 0);
    
    const ttfb = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return nav ? Math.round(nav.responseStart - nav.startTime) : null;
    });

    console.log('\n📊 관리자 대시보드 성능 측정 결과');
    console.log('=====================================');
    console.log(`⏱️  페이지 로드 시간: ${loadTime}ms`);
    console.log(`⏱️  TTFB: ${ttfb}ms`);
    console.log(`📦 JS 총 크기: ${(totalJsSize / 1024).toFixed(2)} KB`);
    
    console.log('\n🔍 상위 JS 리소스:');
    jsResources
      .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
      .slice(0, 5)
      .forEach((r: any) => {
        console.log(`   ${r.name}: ${((r.size || 0) / 1024).toFixed(2)} KB (${r.duration}ms)`);
      });
    
    expect(loadTime, '관리자 페이지 로드 시간이 5초를 초과합니다').toBeLessThan(5000);
    expect(ttfb, '관리자 TTFB가 800ms를 초과합니다').toBeLessThan(800);
  });

  test('코어 웹 바이탈 체크', async ({ page }) => {
    await page.goto('/');
    
    // CLS 측정을 위한 레이아웃 측정
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });
        
        setTimeout(() => resolve(clsValue), 3000);
      });
    });
    
    console.log(`\n📊 CLS (Cumulative Layout Shift): ${cls.toFixed(4)}`);
    
    // CLS 기준: 0.1 이하가 good
    expect(cls, 'CLS가 0.25를 초과합니다').toBeLessThan(0.25);
  });
});

// 번들 분석 테스트
test.describe('📦 번들 분석', () => {
  test('대형 번들 식별', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter((r: any) => r.transferSize > 100 * 1024) // 100KB 이상
        .map((r: any) => ({
          name: r.name,
          size: r.transferSize,
          type: r.initiatorType
        }))
        .sort((a: any, b: any) => b.size - a.size);
    });
    
    console.log('\n🚨 100KB 이상 대형 리소스:');
    console.log('=====================================');
    resources.forEach((r: any) => {
      console.log(`   ${r.name.split('/').pop()}: ${(r.size / 1024).toFixed(2)} KB`);
    });
    
    // 500KB 이상 파일 경고
    const largeFiles = resources.filter((r: any) => r.size > 500 * 1024);
    if (largeFiles.length > 0) {
      console.log(`\n⚠️  500KB 이상 파일 ${largeFiles.length}개 발견 - 코드 분할 필요`);
    }
  });
});
