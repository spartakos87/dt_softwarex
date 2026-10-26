from pathlib import Path
import trimesh, numpy as np
from PIL import Image,ImageDraw,ImageFont
p=Path(__file__).resolve().parents[1] / 'frontend' / 'public';p.mkdir(parents=True,exist_ok=True)
def add_box(scene,name,xyz,extents,color):
 m=trimesh.creation.box(extents=extents)
 m.visual.vertex_colors=np.array(color,dtype=np.uint8)
 matrix=trimesh.transformations.translation_matrix(xyz)
 scene.add_geometry(m,node_name=name,transform=matrix)
def build(idx):
 scene=trimesh.Scene();
 # open-roof plan, common geometry for both floors, generic building inspired by no original assets
 add_box(scene,'Floor', (0,0,-0.07),(12,8,0.14),(220,223,227,255))
 for name,location,scale in [
  ('Wall_N',(0,4,1.1),(12,.16,2.2)),('Wall_S',(0,-4,1.1),(12,.16,2.2)),
  ('Wall_E',(6,0,1.1),(.16,8,2.2)),('Wall_W',(-6,0,1.1),(.16,8,2.2)),
  ('Wall_Center',(-.5,0,1.1),(.16,8,2.2))]:
  add_box(scene,name,location,scale,(215,190,156,235))
 if idx==0:
  sensors=[('AirQuality_Kitchen',(-3,1,1.7)),('EnergyMeter_Lab',(3,1,1.6)),('Heater_Lab',(2,-2,1.15))]
 else:
  sensors=[('AirQuality_Office',(-3,1,1.65)),('Heater_Office',(3,-2,1.1))]
 for name,location in sensors:
  add_box(scene,'IfcSensor/'+name,location,(.42,.38,.42),(38,139,216,255))
 out=p/f'floor_{idx}.glb';out.write_bytes(trimesh.exchange.gltf.export_glb(scene))
 # Image of a made-up test geometry, never an actual floor plan
 im=Image.new('RGB',(1000,640),(246,249,251));d=ImageDraw.Draw(im)
 d.rectangle((70,75,930,550),fill=(235,231,220),outline=(116,91,68),width=9)
 d.line((495,75,495,550),fill=(116,91,68),width=8)
 for x,y,txt in ([(160,200,'Kitchen'),(600,200,'Laboratory')] if idx==0 else [(160,200,'Office A'),(600,200,'Office B')]):
  d.text((x,y),txt,fill=(49,59,79),stroke_width=0)
 d.text((75,585),f'SYNTHETIC DEMO - FLOOR {idx} (not surveyed building geometry)',fill=(90,98,118))
 im.save(p/f'floor_{idx}_captions.jpg',quality=90)
 return out
for i in [0,1]:
 f=build(i);model=trimesh.load(str(f),force='scene');print(f.name,f.stat().st_size, sorted(model.graph.nodes_geometry))
