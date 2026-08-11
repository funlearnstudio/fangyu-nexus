"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Badge, Button, Card, StatePanel } from "@fangyu/ui";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { WebGLRenderer } from "three";

type ModelKind = "steve" | "alex";

interface FigureProps {
  model: ModelKind;
  rotation: number;
  animate: boolean;
  showOuterLayer: boolean;
  showCape: boolean;
  reducedMotion: boolean;
}

function Block({
  position,
  scale,
  color,
  opacity = 1,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  opacity?: number;
}) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.72}
      />
    </mesh>
  );
}

function Figure({
  model,
  rotation,
  animate,
  showOuterLayer,
  showCape,
  reducedMotion,
}: FigureProps) {
  const group = useRef<Group>(null);
  const leftArm = useRef<Mesh>(null);
  const rightArm = useRef<Mesh>(null);
  const leftLeg = useRef<Mesh>(null);
  const rightLeg = useRef<Mesh>(null);
  const armWidth = model === "alex" ? 0.58 : 0.72;

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = rotation;
    if (!animate || reducedMotion) return;
    const swing = Math.sin(clock.elapsedTime * 3.2) * 0.42;
    if (leftArm.current) leftArm.current.rotation.x = swing;
    if (rightArm.current) rightArm.current.rotation.x = -swing;
    if (leftLeg.current) leftLeg.current.rotation.x = -swing;
    if (rightLeg.current) rightLeg.current.rotation.x = swing;
  });

  return (
    <group ref={group} position={[0, -0.45, 0]}>
      <Block
        position={[0, 2.65, 0]}
        scale={[1.46, 1.46, 1.46]}
        color="#b67c52"
      />
      <Block
        position={[0, 1.25, 0]}
        scale={[1.48, 1.65, 0.78]}
        color="#2ea6a8"
      />
      <mesh
        ref={leftArm}
        position={[-1.1, 1.25, 0]}
        scale={[armWidth, 1.65, 0.78]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#c88c60" roughness={0.72} />
      </mesh>
      <mesh
        ref={rightArm}
        position={[1.1, 1.25, 0]}
        scale={[armWidth, 1.65, 0.78]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#c88c60" roughness={0.72} />
      </mesh>
      <mesh
        ref={leftLeg}
        position={[-0.42, -0.45, 0]}
        scale={[0.72, 1.85, 0.78]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#293f77" roughness={0.78} />
      </mesh>
      <mesh
        ref={rightLeg}
        position={[0.42, -0.45, 0]}
        scale={[0.72, 1.85, 0.78]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#293f77" roughness={0.78} />
      </mesh>

      {showOuterLayer ? (
        <>
          <Block
            position={[0, 2.65, 0]}
            scale={[1.53, 1.53, 1.53]}
            color="#72e0c4"
            opacity={0.28}
          />
          <Block
            position={[0, 1.25, 0]}
            scale={[1.55, 1.72, 0.85]}
            color="#a8f0df"
            opacity={0.16}
          />
        </>
      ) : null}

      {showCape ? (
        <Block
          position={[0, 1.1, 0.55]}
          scale={[1.35, 2.5, 0.12]}
          color="#a83345"
        />
      ) : null}
    </group>
  );
}

function Scene(props: FigureProps) {
  return (
    <>
      <color attach="background" args={["#09110f"]} />
      <ambientLight intensity={1.45} />
      <directionalLight position={[4, 7, 6]} intensity={2.1} color="#c9fff2" />
      <directionalLight
        position={[-4, 2, -3]}
        intensity={0.8}
        color="#63d7ff"
      />
      <Figure {...props} />
      <gridHelper
        args={[12, 12, "#2d8b6f", "#172923"]}
        position={[0, -1.4, 0]}
      />
    </>
  );
}

function CameraRig({ distance }: { distance: number }) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.set(0, 1.1, distance);
    camera.lookAt(0, 0.6, 0);
    camera.updateProjectionMatrix();
  }, [camera, distance]);

  return null;
}

function useReducedMotion() {
  return useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
}

function useGraphicsSupport() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      const browserNavigator = navigator as Navigator & {
        gpu?: { requestAdapter: () => Promise<unknown | null> };
      };
      let hasWebGpu = false;

      try {
        hasWebGpu = Boolean(await browserNavigator.gpu?.requestAdapter());
      } catch {
        hasWebGpu = false;
      }

      let hasWebGl2 = false;
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("webgl2", {
          antialias: true,
          failIfMajorPerformanceCaveat: true,
        });
        hasWebGl2 = context !== null;
        context?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        hasWebGl2 = false;
      }

      if (!cancelled) setSupported(hasWebGpu || hasWebGl2);
    };

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  return supported;
}

export function SkinViewer() {
  const [model, setModel] = useState<ModelKind>("steve");
  const [rotation, setRotation] = useState(0.45);
  const [zoom, setZoom] = useState(7.2);
  const [animate, setAnimate] = useState(true);
  const [showOuterLayer, setShowOuterLayer] = useState(true);
  const [showCape, setShowCape] = useState(false);
  const [renderer, setRenderer] = useState<
    "detecting" | "webgpu" | "webgl2" | "unavailable"
  >("detecting");
  const reducedMotion = useReducedMotion();
  const graphicsSupported = useGraphicsSupport();

  useEffect(() => {
    if (graphicsSupported === false) setRenderer("unavailable");
  }, [graphicsSupported]);

  const rendererLabel = {
    detecting: "偵測中",
    webgpu: "WebGPU",
    webgl2: "WebGL2",
    unavailable: "安全降級",
  }[renderer];

  return (
    <div className="skin-viewer-layout">
      <Card className="skin-canvas-card">
        <div className="viewer-status">
          <Badge tone={renderer === "unavailable" ? "warning" : "source"}>
            {rendererLabel}
          </Badge>
          <span>可旋轉、縮放、切換模型層</span>
        </div>
        <div
          className="skin-canvas"
          role="img"
          aria-label="原創示範玩家皮膚 3D 預覽"
        >
          {graphicsSupported === null ? (
            <StatePanel state="loading" title="檢查 3D 渲染能力">
              正在選擇 WebGPU 或 WebGL2 渲染路徑。
            </StatePanel>
          ) : graphicsSupported ? (
            <Suspense
              fallback={
                <StatePanel state="loading" title="建立 3D 場景">
                  正在準備幾何與材質。
                </StatePanel>
              }
            >
              <Canvas
                camera={{ position: [0, 1.1, zoom], fov: 38 }}
                dpr={[1, 1.75]}
                gl={async (properties) => {
                  if ("gpu" in navigator) {
                    try {
                      const { WebGPURenderer } = await import("three/webgpu");
                      const webgpu = new WebGPURenderer({
                        canvas: properties.canvas as HTMLCanvasElement,
                        antialias: true,
                      });
                      await webgpu.init();
                      setRenderer("webgpu");
                      return webgpu;
                    } catch {
                      setRenderer("webgl2");
                    }
                  }
                  const webgl = new WebGLRenderer({
                    ...properties,
                    antialias: true,
                  });
                  setRenderer("webgl2");
                  return webgl;
                }}
              >
                <CameraRig distance={zoom} />
                <Scene
                  model={model}
                  rotation={rotation}
                  animate={animate}
                  showOuterLayer={showOuterLayer}
                  showCape={showCape}
                  reducedMotion={reducedMotion}
                />
              </Canvas>
            </Suspense>
          ) : (
            <StatePanel state="stale" title="此瀏覽器無可用的 GPU 畫布">
              3D 預覽已安全停用；其餘頁面與控制仍可使用。請在支援 WebGPU 或
              WebGL2 的瀏覽器開啟，即可恢復互動預覽。
            </StatePanel>
          )}
        </div>
      </Card>

      <Card className="skin-controls">
        <p className="eyebrow">VIEW CONTROLS</p>
        <h2>預覽控制</h2>

        <fieldset>
          <legend>模型幾何</legend>
          <div className="segmented-control">
            <Button
              type="button"
              variant={model === "steve" ? "primary" : "secondary"}
              onClick={() => setModel("steve")}
            >
              Steve（寬手臂）
            </Button>
            <Button
              type="button"
              variant={model === "alex" ? "primary" : "secondary"}
              onClick={() => setModel("alex")}
            >
              Alex（窄手臂）
            </Button>
          </div>
        </fieldset>

        <label>
          <span>旋轉角度</span>
          <input
            type="range"
            min={-3.14}
            max={3.14}
            step={0.02}
            value={rotation}
            onChange={(event) => setRotation(Number(event.currentTarget.value))}
          />
        </label>
        <label>
          <span>鏡頭距離</span>
          <input
            type="range"
            min={5.8}
            max={10}
            step={0.1}
            value={zoom}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
          />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={showOuterLayer}
            onChange={(event) => setShowOuterLayer(event.currentTarget.checked)}
          />
          顯示外層（帽子／外套架構）
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={showCape}
            onChange={(event) => setShowCape(event.currentTarget.checked)}
          />
          顯示披風掛載層
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={animate && !reducedMotion}
            disabled={reducedMotion}
            onChange={(event) => setAnimate(event.currentTarget.checked)}
          />
          基本走路動畫
        </label>

        {reducedMotion ? (
          <StatePanel state="stale" title="已尊重減少動態效果偏好">
            瀏覽器要求降低動態效果，因此自動停用走路動畫；旋轉滑桿仍可手動使用。
          </StatePanel>
        ) : null}
      </Card>
    </div>
  );
}
