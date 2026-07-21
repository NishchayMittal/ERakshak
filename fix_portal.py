import re

with open('/tmp/a03387a_PortalPage.tsx', 'r') as f:
    content = f.read()

# 1. Apply user feedback
# "bring it even more down"
content = content.replace("globeGroup.position.y = -20;", "globeGroup.position.y = -200;")
# "zoom in"
content = content.replace("camera.position.set(0, 0, baseCameraZ);", "camera.position.set(0, 0, 700);")
# "dont rotate it anymore"
content = content.replace("globeGroup.rotation.y += 0.0015;", "// globeGroup.rotation.y += 0.0015;")

# 2. Add raycaster tooltip logic
content = content.replace("function EarthEffect() {", "function EarthEffect({ tooltipRef, onNodeClick }: { tooltipRef: React.RefObject<HTMLDivElement | null>, onNodeClick: () => void }) {")

# Remove vanilla DOM tooltip creation
tooltip_creation_regex = r"const tooltip = document\.createElement\('div'\);.*?document\.body\.appendChild\(tooltip\);"
content = re.sub(tooltip_creation_regex, "", content, flags=re.DOTALL)

# Fix mouse move to just update ref
mouse_move_old = """      tooltip.style.left = `${event.clientX + 15}px`;
      tooltip.style.top = `${event.clientY + 15}px`;"""
mouse_move_new = """      if (tooltipRef.current) {
        tooltipRef.current.style.left = `${event.clientX + 15}px`;
        tooltipRef.current.style.top = `${event.clientY + 15}px`;
      }"""
content = content.replace(mouse_move_old, mouse_move_new)

# Add click event
click_event = """    const onClick = () => {
      if (!isZooming) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactiveNodes);
        if (intersects.length > 0) {
          onNodeClick();
        }
      }
    };
    window.addEventListener('click', onClick);"""
content = content.replace("window.addEventListener('mousemove', onMouseMove);", "window.addEventListener('mousemove', onMouseMove);\n" + click_event)

# Fix hover detection
hover_old = """          tooltip.innerText = hovered.userData.label;
          tooltip.style.opacity = '1';
          document.body.style.cursor = 'crosshair';
        } else {
          tooltip.style.opacity = '0';
          document.body.style.cursor = 'default';
        }
      } else {
        tooltip.style.opacity = '0';
      }"""
hover_new = """          if (tooltipRef.current) {
            const labelEl = tooltipRef.current.querySelector('.cyber-tooltip-label');
            if (labelEl) labelEl.textContent = hovered.userData.label;
            tooltipRef.current.style.opacity = '1';
          }
          document.body.style.cursor = 'crosshair';
        } else {
          if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
          document.body.style.cursor = 'default';
        }
      } else {
          if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
      }"""
content = content.replace(hover_old, hover_new)

# Fix cleanup
cleanup_old = """      if (document.body.contains(tooltip)) {
        document.body.removeChild(tooltip);
      }"""
cleanup_new = """      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = '0';
      }"""
content = content.replace(cleanup_old, cleanup_new)
content = content.replace("window.removeEventListener('mousemove', onMouseMove);", "window.removeEventListener('mousemove', onMouseMove);\n      window.removeEventListener('click', onClick);")

# 3. Add PortalPage ref and overlay
content = content.replace("export default function PortalPage() {", "export default function PortalPage() {\n  const tooltipRef = useRef<HTMLDivElement>(null);")
content = content.replace("<EarthEffect />", "<EarthEffect tooltipRef={tooltipRef} onNodeClick={handleEnterClick} />")
content = content.replace("onClick={handleEnterDashboard}", "onClick={handleEnterClick}")

# Add tooltip overlay
tooltip_overlay = """
      {/* CyberCard Tooltip Overlay */}
      <div 
        ref={tooltipRef}
        style={{
          position: 'absolute',
          top: -1000, 
          left: -1000, 
          opacity: 0, 
          pointerEvents: 'none', 
          zIndex: 100, 
          transition: 'opacity 0.2s ease-in-out'
        }}
      >
        <CyberCard>
          <div style={{ padding: '8px', minWidth: '120px' }}>
            <div style={{ fontSize: '10px', color: '#6E7681', marginBottom: '4px' }}>INTERCEPT NODE</div>
            <div className="cyber-tooltip-label" style={{ color: '#39FF14', fontSize: '12px', fontWeight: 'bold' }}>-</div>
          </div>
        </CyberCard>
      </div>
    </div>"""
content = content.replace("    </div>\n  );\n}", tooltip_overlay + "\n  );\n}")

with open('/Users/shreyuuu/Desktop/ERakshak/frontend/src/pages/PortalPage.tsx', 'w') as f:
    f.write(content)
